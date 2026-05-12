from __future__ import annotations

import json
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

from sqlalchemy import select
from sqlalchemy.orm import Session

from kuti_backend.core.settings import Settings
from kuti_backend.exports.models import Export, ExportFormat, ExportKind, ExportStatus
from kuti_backend.exports.schemas import ExportCreate
from kuti_backend.projects.models import Project
from kuti_backend.projects.repository import slugify
from kuti_backend.story.repository import list_orphans, list_references
from kuti_backend.story.schemas import StoryReferenceRead
from kuti_backend.warnings.repository import list_warnings
from kuti_backend.warnings.schemas import WarningRead
from kuti_backend.versions.repository import _serialize_project


def _project_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError("project_not_found")
    return project


def list_exports(session: Session, project_id: str, kind: ExportKind | None = None, status: ExportStatus | None = None) -> list[Export]:
    stmt = select(Export).where(Export.project_id == project_id)
    if kind is not None:
        stmt = stmt.where(Export.kind == kind.value)
    if status is not None:
        stmt = stmt.where(Export.status == status.value)
    stmt = stmt.order_by(Export.created_at.desc())
    return list(session.scalars(stmt))


def get_export(session: Session, project_id: str, export_id: str) -> Export | None:
    stmt = select(Export).where(Export.project_id == project_id, Export.id == export_id)
    return session.scalar(stmt)


def _export_root(settings: Settings, project: Project, export_id: str) -> Path:
    root = settings.exports_dir / project.slug / export_id
    root.mkdir(parents=True, exist_ok=True)
    return root


def _collect_snapshot(session: Session, project_id: str) -> dict[str, object]:
    snapshot = deepcopy(_serialize_project(session, project_id))
    snapshot["warnings"] = [WarningRead.model_validate(warning).model_dump(mode="json") for warning in list_warnings(session, project_id)]
    snapshot["orphans"] = [orphan.model_dump(mode="json") for orphan in list_orphans(session, project_id)]
    snapshot["references"] = [StoryReferenceRead.model_validate(reference).model_dump(mode="json") for reference in list_references(session, project_id)]
    return snapshot


def _collections(snapshot: dict[str, object]) -> dict[str, int]:
    return {
        key: len(snapshot.get(key, []))
        for key in [
            "characters",
            "relations",
            "voice_samples",
            "tomes",
            "chapters",
            "scenes",
            "story_references",
            "assets",
            "asset_links",
            "warnings",
        ]
    }


def _manifest(project: Project, export: Export, snapshot: dict[str, object]) -> dict[str, object]:
    return {
        "export": {
            "id": export.id,
            "kind": export.kind,
            "format": export.format,
            "label": export.label,
            "summary": export.summary,
            "created_at": export.created_at.isoformat(),
        },
        "project": snapshot["project"],
        "collections": _collections(snapshot),
    }


def _write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _path_size(path: Path) -> int | None:
    if not path.exists():
        return None
    if path.is_file():
        return path.stat().st_size
    total = 0
    for file_path in path.rglob("*"):
        if file_path.is_file():
            total += file_path.stat().st_size
    return total


def _tree_payload(snapshot: dict[str, object], manifest: dict[str, object], tree_dir: Path) -> None:
    tree_dir.mkdir(parents=True, exist_ok=True)
    _write_json(tree_dir / "manifest.json", manifest)
    _write_json(tree_dir / "project" / "project.json", snapshot["project"])
    _write_json(tree_dir / "characters" / "characters.json", {"items": snapshot["characters"]})
    _write_json(tree_dir / "characters" / "relations.json", {"items": snapshot["relations"]})
    _write_json(tree_dir / "characters" / "voice-samples.json", {"items": snapshot["voice_samples"]})
    _write_json(tree_dir / "story" / "tomes.json", {"items": snapshot["tomes"]})
    _write_json(tree_dir / "story" / "chapters.json", {"items": snapshot["chapters"]})
    _write_json(tree_dir / "story" / "scenes.json", {"items": snapshot["scenes"]})
    _write_json(tree_dir / "story" / "references.json", {"items": snapshot["story_references"]})
    _write_json(tree_dir / "story" / "orphans.json", {"items": snapshot["orphans"]})
    _write_json(tree_dir / "assets" / "assets.json", {"items": snapshot["assets"]})
    _write_json(tree_dir / "assets" / "links.json", {"items": snapshot["asset_links"]})
    _write_json(tree_dir / "warnings" / "warnings.json", {"items": snapshot["warnings"]})


def _zip_tree(tree_dir: Path, zip_path: Path) -> None:
    with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as archive:
        for file_path in tree_dir.rglob("*"):
            if file_path.is_file():
                archive.write(file_path, file_path.relative_to(tree_dir).as_posix())


def _finalize_export(session: Session, export: Export, *, artifact_path: Path, metadata: dict[str, object], status: ExportStatus) -> Export:
    export.artifact_path = str(artifact_path)
    export.artifact_name = artifact_path.name
    export.metadata_json = metadata
    export.size_bytes = _path_size(artifact_path)
    export.status = status.value
    export.completed_at = datetime.now(UTC) if status == ExportStatus.ready else None
    export.failed_at = datetime.now(UTC) if status == ExportStatus.failed else None
    export.error_message = None if status == ExportStatus.ready else export.error_message
    export.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(export)
    return export


def create_export(session: Session, settings: Settings, project_id: str, payload: ExportCreate) -> Export:
    project = _project_or_404(session, project_id)
    snapshot = _collect_snapshot(session, project_id)

    export = Export(
        id=str(uuid4()),
        project_id=project_id,
        kind=payload.kind.value,
        format=payload.format.value,
        status=ExportStatus.pending.value,
        label=payload.label or f"{payload.kind.value.title()} export",
        summary=payload.summary,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(export)
    session.flush()

    root = _export_root(settings, project, export.id)
    base_name = slugify(export.label)
    manifest = _manifest(project, export, snapshot)

    try:
        if payload.format == ExportFormat.json:
            artifact_path = root / f"{base_name}.json"
            _write_json(artifact_path, {"manifest": manifest, "snapshot": snapshot})
            metadata = {**manifest, "artifact_type": "json"}
            return _finalize_export(session, export, artifact_path=artifact_path, metadata=metadata, status=ExportStatus.ready)

        if payload.format == ExportFormat.tree:
            tree_dir = root / "tree"
            _tree_payload(snapshot, manifest, tree_dir)
            metadata = {**manifest, "artifact_type": "tree", "tree_path": str(tree_dir)}
            return _finalize_export(session, export, artifact_path=tree_dir, metadata=metadata, status=ExportStatus.ready)

        if payload.format == ExportFormat.zip:
            tree_dir = root / "tree"
            _tree_payload(snapshot, manifest, tree_dir)
            artifact_path = root / f"{base_name}.zip"
            _zip_tree(tree_dir, artifact_path)
            metadata = {**manifest, "artifact_type": "zip", "tree_path": str(tree_dir)}
            return _finalize_export(session, export, artifact_path=artifact_path, metadata=metadata, status=ExportStatus.ready)

        raise ValueError(f"unsupported export format: {payload.format}")
    except Exception as exc:
        export.status = ExportStatus.failed.value
        export.failed_at = datetime.now(UTC)
        export.updated_at = datetime.now(UTC)
        export.error_message = str(exc)
        session.commit()
        session.refresh(export)
        return export
