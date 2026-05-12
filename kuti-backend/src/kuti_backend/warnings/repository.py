from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha256
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from kuti_backend.characters.models import Character
from kuti_backend.projects.models import Project
from kuti_backend.story.repository import list_orphans, list_scenes, list_chapters, list_tomes
from kuti_backend.warnings.models import Warning
from kuti_backend.warnings.schemas import WarningKind, WarningSeverity, WarningStatus, WarningUpdate


def _project_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError("project_not_found")
    return project


def _fingerprint(*parts: object) -> str:
    payload = "::".join(str(part) for part in parts)
    return sha256(payload.encode("utf-8")).hexdigest()


def _warning(
    *,
    project_id: str,
    kind: WarningKind,
    severity: WarningSeverity,
    title: str,
    message: str,
    entity_kind: str,
    entity_id: str,
    fingerprint: str,
    metadata_json: dict,
    existing: Warning | None,
    ) -> Warning:
    warning = existing or Warning(
        id=str(uuid4()),
        project_id=project_id,
        fingerprint=fingerprint,
        kind=kind.value,
        severity=severity.value,
        status=WarningStatus.open.value,
        title=title,
        message=message,
        entity_kind=entity_kind,
        entity_id=entity_id,
        metadata_json=metadata_json,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    if existing is None:
        warning.status = WarningStatus.open.value
        warning.resolved_at = None
    elif warning.status == WarningStatus.resolved.value:
        warning.status = WarningStatus.open.value
        warning.resolved_at = None
    warning.kind = kind.value
    warning.severity = severity.value
    warning.title = title
    warning.message = message
    warning.entity_kind = entity_kind
    warning.entity_id = entity_id
    warning.metadata_json = metadata_json
    warning.updated_at = datetime.now(UTC)
    return warning


def list_warnings(session: Session, project_id: str) -> list[Warning]:
    stmt = select(Warning).where(Warning.project_id == project_id).order_by(Warning.status.asc(), Warning.severity.desc(), Warning.updated_at.desc())
    return list(session.scalars(stmt))


def get_warning(session: Session, project_id: str, warning_id: str) -> Warning | None:
    stmt = select(Warning).where(Warning.project_id == project_id, Warning.id == warning_id)
    return session.scalar(stmt)


def update_warning(session: Session, warning: Warning, payload: WarningUpdate) -> Warning:
    warning.status = payload.status.value
    warning.resolved_at = datetime.now(UTC) if payload.status == WarningStatus.resolved else None
    warning.updated_at = datetime.now(UTC)
    if payload.note:
        warning.metadata_json = {**(warning.metadata_json or {}), "note": payload.note}
    session.commit()
    session.refresh(warning)
    return warning


def _existing_by_fingerprint(session: Session, project_id: str) -> dict[str, Warning]:
    return {warning.fingerprint: warning for warning in list_warnings(session, project_id)}


def _scene_character_warnings(session: Session, project_id: str, existing: dict[str, Warning], warnings: list[Warning]) -> None:
    characters = list(session.scalars(select(Character).where(Character.project_id == project_id)))
    lookup = {character.slug.lower(): character for character in characters}
    lookup.update({character.name.lower(): character for character in characters})

    for scene in list_scenes(session, project_id):
        for entry in scene.characters_json:
            needle = entry.strip().lower()
            if not needle:
                continue
            if needle not in lookup:
                fingerprint = _fingerprint("missing_character_reference", scene.id, needle)
                warnings.append(
                    _warning(
                        project_id=project_id,
                        kind=WarningKind.missing_character_reference,
                        severity=WarningSeverity.warning,
                        title=f"Missing character in {scene.title}",
                        message=f'Scene "{scene.title}" references character "{entry}" which does not exist in the project.',
                        entity_kind="scene",
                        entity_id=scene.id,
                        fingerprint=fingerprint,
                        metadata_json={"scene_id": scene.id, "scene_title": scene.title, "character_name": entry},
                        existing=existing.get(fingerprint),
                    )
                )


def _location_warnings(session: Session, project_id: str, existing: dict[str, Warning], warnings: list[Warning]) -> None:
    project = _project_or_404(session, project_id)
    allowed_locations = {
        str(item).strip().lower()
        for item in (project.settings_json or {}).get("locations_json", [])
        if str(item).strip()
    }
    if not allowed_locations:
        return

    for scene in list_scenes(session, project_id):
        location = scene.location.strip()
        if not location:
            continue
        if location.lower() not in allowed_locations:
            fingerprint = _fingerprint("invalid_location", scene.id, location.lower())
            warnings.append(
                _warning(
                    project_id=project_id,
                    kind=WarningKind.invalid_location,
                    severity=WarningSeverity.warning,
                    title=f"Unknown location in {scene.title}",
                    message=f'Scene "{scene.title}" uses location "{location}" which is not declared in project settings.',
                    entity_kind="scene",
                    entity_id=scene.id,
                    fingerprint=fingerprint,
                    metadata_json={"scene_id": scene.id, "scene_title": scene.title, "location": location},
                    existing=existing.get(fingerprint),
                )
            )


def _timeline_warnings(session: Session, project_id: str, existing: dict[str, Warning], warnings: list[Warning]) -> None:
    for tome in list_tomes(session, project_id):
        tome_chapters = list_chapters(session, project_id, tome.id)
        seen: dict[int, list[str]] = {}
        for chapter in tome_chapters:
            seen.setdefault(chapter.order_index, []).append(chapter.id)
        for order_index, ids in seen.items():
            if len(ids) > 1:
                fingerprint = _fingerprint("timeline_incoherence", "tome", tome.id, "chapters", order_index)
                warnings.append(
                    _warning(
                        project_id=project_id,
                        kind=WarningKind.timeline_incoherence,
                        severity=WarningSeverity.critical,
                        title=f"Chapter order conflict in {tome.title}",
                        message=f'Tome "{tome.title}" has multiple chapters at order index {order_index}.',
                        entity_kind="tome",
                        entity_id=tome.id,
                        fingerprint=fingerprint,
                        metadata_json={"tome_id": tome.id, "order_index": order_index, "chapter_ids": ids},
                        existing=existing.get(fingerprint),
                    )
                )

        for chapter in tome_chapters:
            chapter_scenes = list_scenes(session, project_id, chapter.id)
            scene_orders: dict[int, list[str]] = {}
            for scene in chapter_scenes:
                scene_orders.setdefault(scene.order_index, []).append(scene.id)
            for order_index, ids in scene_orders.items():
                if len(ids) > 1:
                    fingerprint = _fingerprint("timeline_incoherence", "chapter", chapter.id, "scenes", order_index)
                    warnings.append(
                        _warning(
                            project_id=project_id,
                            kind=WarningKind.timeline_incoherence,
                            severity=WarningSeverity.critical,
                            title=f"Scene order conflict in {chapter.title}",
                            message=f'Chapter "{chapter.title}" has multiple scenes at order index {order_index}.',
                            entity_kind="chapter",
                            entity_id=chapter.id,
                            fingerprint=fingerprint,
                            metadata_json={"chapter_id": chapter.id, "order_index": order_index, "scene_ids": ids},
                            existing=existing.get(fingerprint),
                        )
                    )


def rebuild_warnings(session: Session, project_id: str) -> list[Warning]:
    _project_or_404(session, project_id)
    existing = _existing_by_fingerprint(session, project_id)
    warnings: list[Warning] = []

    _scene_character_warnings(session, project_id, existing, warnings)
    _location_warnings(session, project_id, existing, warnings)
    _timeline_warnings(session, project_id, existing, warnings)

    for orphan in list_orphans(session, project_id):
        fingerprint = _fingerprint("orphan_reference", orphan.reference.id)
        warnings.append(
            _warning(
                project_id=project_id,
                kind=WarningKind.orphan_reference,
                severity=WarningSeverity.warning,
                title=f"Orphan reference in scene",
                message=f'Reference "{orphan.reference.raw_token}" in scene {orphan.reference.scene_id} points to a missing target.',
                entity_kind="scene",
                entity_id=orphan.reference.scene_id,
                fingerprint=fingerprint,
                metadata_json={
                    "reference_id": orphan.reference.id,
                    "scene_id": orphan.reference.scene_id,
                    "raw_token": orphan.reference.raw_token,
                    "target_slug": orphan.reference.target_slug,
                    "reason": orphan.reason,
                },
                existing=existing.get(fingerprint),
            )
        )

    warning_map = {warning.fingerprint: warning for warning in warnings}
    current_fingerprints = set(warning_map)

    for fingerprint, warning in existing.items():
        if fingerprint not in current_fingerprints and warning.status != WarningStatus.resolved.value:
            warning.status = WarningStatus.resolved.value
            warning.resolved_at = datetime.now(UTC)
            warning.updated_at = datetime.now(UTC)

    existing_ids = {item.id for item in existing.values()}
    for warning in warnings:
        if warning.id not in existing_ids:
            session.add(warning)

    session.commit()
    return list_warnings(session, project_id)
