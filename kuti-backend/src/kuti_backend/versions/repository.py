from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from kuti_backend.assets.models import Asset, AssetLink
from kuti_backend.characters.models import Character, CharacterRelation, VoiceSample
from kuti_backend.projects.models import Project
from kuti_backend.story.models import Chapter, Scene, StoryReference, Tome
from kuti_backend.versions.models import Version
from kuti_backend.versions.schemas import VersionBranchRead, VersionCompareRead, VersionCreate, VersionRead


def _project_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError("project_not_found")
    return project


def _serialize_project(session: Session, project_id: str) -> dict[str, object]:
    project = _project_or_404(session, project_id)
    characters = list(session.scalars(select(Character).where(Character.project_id == project_id)))
    relations = list(session.scalars(select(CharacterRelation).where(CharacterRelation.project_id == project_id)))
    voice_samples = list(session.scalars(select(VoiceSample).where(VoiceSample.project_id == project_id)))
    tomes = list(session.scalars(select(Tome).where(Tome.project_id == project_id)))
    chapters = list(session.scalars(select(Chapter).where(Chapter.project_id == project_id)))
    scenes = list(session.scalars(select(Scene).where(Scene.project_id == project_id)))
    references = list(session.scalars(select(StoryReference).where(StoryReference.project_id == project_id)))
    assets = list(session.scalars(select(Asset).where(Asset.project_id == project_id)))
    links = list(session.scalars(select(AssetLink).where(AssetLink.project_id == project_id)))

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "slug": project.slug,
            "status": project.status,
            "root_path": project.root_path,
            "settings_json": deepcopy(project.settings_json),
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
            "last_opened_at": project.last_opened_at.isoformat() if project.last_opened_at else None,
            "archived_at": project.archived_at.isoformat() if project.archived_at else None,
        },
        "characters": [
            {
                "id": item.id,
                "project_id": item.project_id,
                "slug": item.slug,
                "name": item.name,
                "alias": item.alias,
                "narrative_role": item.narrative_role,
                "description": item.description,
                "physical_description": item.physical_description,
                "color_palette_json": deepcopy(item.color_palette_json),
                "costume_elements_json": deepcopy(item.costume_elements_json),
                "key_traits_json": deepcopy(item.key_traits_json),
                "personality": item.personality,
                "narrative_arc": item.narrative_arc,
                "tags_json": deepcopy(item.tags_json),
                "status": item.status,
                "created_at": item.created_at.isoformat(),
                "updated_at": item.updated_at.isoformat(),
                "archived_at": item.archived_at.isoformat() if item.archived_at else None,
            }
            for item in characters
        ],
        "relations": [
            {
                "id": item.id,
                "project_id": item.project_id,
                "source_character_id": item.source_character_id,
                "target_character_id": item.target_character_id,
                "relation_type": item.relation_type,
                "strength": item.strength,
                "narrative_dependency": item.narrative_dependency,
                "notes": item.notes,
                "created_at": item.created_at.isoformat(),
                "updated_at": item.updated_at.isoformat(),
            }
            for item in relations
        ],
        "voice_samples": [
            {
                "id": item.id,
                "project_id": item.project_id,
                "character_id": item.character_id,
                "asset_path": item.asset_path,
                "label": item.label,
                "voice_notes": item.voice_notes,
                "created_at": item.created_at.isoformat(),
            }
            for item in voice_samples
        ],
        "tomes": [
            {
                "id": item.id,
                "project_id": item.project_id,
                "title": item.title,
                "slug": item.slug,
                "synopsis": item.synopsis,
                "status": item.status,
                "order_index": item.order_index,
                "created_at": item.created_at.isoformat(),
                "updated_at": item.updated_at.isoformat(),
            }
            for item in tomes
        ],
        "chapters": [
            {
                "id": item.id,
                "project_id": item.project_id,
                "tome_id": item.tome_id,
                "title": item.title,
                "slug": item.slug,
                "synopsis": item.synopsis,
                "status": item.status,
                "order_index": item.order_index,
                "created_at": item.created_at.isoformat(),
                "updated_at": item.updated_at.isoformat(),
            }
            for item in chapters
        ],
        "scenes": [
            {
                "id": item.id,
                "project_id": item.project_id,
                "tome_id": item.tome_id,
                "chapter_id": item.chapter_id,
                "title": item.title,
                "slug": item.slug,
                "scene_type": item.scene_type,
                "location": item.location,
                "summary": item.summary,
                "content": item.content,
                "notes": item.notes,
                "characters_json": deepcopy(item.characters_json),
                "tags_json": deepcopy(item.tags_json),
                "status": item.status,
                "order_index": item.order_index,
                "created_at": item.created_at.isoformat(),
                "updated_at": item.updated_at.isoformat(),
            }
            for item in scenes
        ],
        "story_references": [
            {
                "id": item.id,
                "project_id": item.project_id,
                "scene_id": item.scene_id,
                "reference_kind": item.reference_kind,
                "target_slug": item.target_slug,
                "raw_token": item.raw_token,
                "created_at": item.created_at.isoformat(),
            }
            for item in references
        ],
        "assets": [
            {
                "id": item.id,
                "project_id": item.project_id,
                "slug": item.slug,
                "name": item.name,
                "original_filename": item.original_filename,
                "mime_type": item.mime_type,
                "checksum": item.checksum,
                "size_bytes": item.size_bytes,
                "storage_path": item.storage_path,
                "description": item.description,
                "tags_json": deepcopy(item.tags_json),
                "status": item.status,
                "created_at": item.created_at.isoformat(),
                "updated_at": item.updated_at.isoformat(),
                "archived_at": item.archived_at.isoformat() if item.archived_at else None,
            }
            for item in assets
        ],
        "asset_links": [
            {
                "id": item.id,
                "project_id": item.project_id,
                "asset_id": item.asset_id,
                "target_kind": item.target_kind,
                "target_id": item.target_id,
                "note": item.note,
                "created_at": item.created_at.isoformat(),
            }
            for item in links
        ],
    }


def _restore_from_snapshot(session: Session, project_id: str, snapshot: dict[str, object]) -> None:
    session.execute(delete(CharacterRelation).where(CharacterRelation.project_id == project_id))
    session.execute(delete(VoiceSample).where(VoiceSample.project_id == project_id))
    session.execute(delete(StoryReference).where(StoryReference.project_id == project_id))
    session.execute(delete(Scene).where(Scene.project_id == project_id))
    session.execute(delete(Chapter).where(Chapter.project_id == project_id))
    session.execute(delete(Tome).where(Tome.project_id == project_id))
    session.execute(delete(AssetLink).where(AssetLink.project_id == project_id))
    session.execute(delete(Asset).where(Asset.project_id == project_id))
    session.execute(delete(Character).where(Character.project_id == project_id))

    project_payload = snapshot["project"]
    project = _project_or_404(session, project_id)
    project.name = project_payload["name"]
    project.slug = project_payload["slug"]
    project.status = project_payload["status"]
    project.root_path = project_payload["root_path"]
    project.settings_json = project_payload["settings_json"]
    project.created_at = datetime.fromisoformat(project_payload["created_at"])
    project.updated_at = datetime.fromisoformat(project_payload["updated_at"])
    project.last_opened_at = datetime.fromisoformat(project_payload["last_opened_at"]) if project_payload["last_opened_at"] else None
    project.archived_at = datetime.fromisoformat(project_payload["archived_at"]) if project_payload["archived_at"] else None

    for payload in snapshot.get("characters", []):
        session.add(
            Character(
                id=payload["id"],
                project_id=payload["project_id"],
                slug=payload["slug"],
                name=payload["name"],
                alias=payload["alias"],
                narrative_role=payload["narrative_role"],
                description=payload["description"],
                physical_description=payload["physical_description"],
                color_palette_json=payload["color_palette_json"],
                costume_elements_json=payload["costume_elements_json"],
                key_traits_json=payload["key_traits_json"],
                personality=payload["personality"],
                narrative_arc=payload["narrative_arc"],
                tags_json=payload["tags_json"],
                status=payload["status"],
                created_at=datetime.fromisoformat(payload["created_at"]),
                updated_at=datetime.fromisoformat(payload["updated_at"]),
                archived_at=datetime.fromisoformat(payload["archived_at"]) if payload["archived_at"] else None,
            )
        )

    for payload in snapshot.get("relations", []):
        session.add(
            CharacterRelation(
                id=payload["id"],
                project_id=payload["project_id"],
                source_character_id=payload["source_character_id"],
                target_character_id=payload["target_character_id"],
                relation_type=payload["relation_type"],
                strength=payload["strength"],
                narrative_dependency=payload["narrative_dependency"],
                notes=payload["notes"],
                created_at=datetime.fromisoformat(payload["created_at"]),
                updated_at=datetime.fromisoformat(payload["updated_at"]),
            )
        )

    for payload in snapshot.get("voice_samples", []):
        session.add(
            VoiceSample(
                id=payload["id"],
                project_id=payload["project_id"],
                character_id=payload["character_id"],
                asset_path=payload["asset_path"],
                label=payload["label"],
                voice_notes=payload["voice_notes"],
                created_at=datetime.fromisoformat(payload["created_at"]),
            )
        )

    for payload in snapshot.get("tomes", []):
        session.add(
            Tome(
                id=payload["id"],
                project_id=payload["project_id"],
                title=payload["title"],
                slug=payload["slug"],
                synopsis=payload["synopsis"],
                status=payload["status"],
                order_index=payload["order_index"],
                created_at=datetime.fromisoformat(payload["created_at"]),
                updated_at=datetime.fromisoformat(payload["updated_at"]),
            )
        )

    for payload in snapshot.get("chapters", []):
        session.add(
            Chapter(
                id=payload["id"],
                project_id=payload["project_id"],
                tome_id=payload["tome_id"],
                title=payload["title"],
                slug=payload["slug"],
                synopsis=payload["synopsis"],
                status=payload["status"],
                order_index=payload["order_index"],
                created_at=datetime.fromisoformat(payload["created_at"]),
                updated_at=datetime.fromisoformat(payload["updated_at"]),
            )
        )

    for payload in snapshot.get("scenes", []):
        session.add(
            Scene(
                id=payload["id"],
                project_id=payload["project_id"],
                tome_id=payload["tome_id"],
                chapter_id=payload["chapter_id"],
                title=payload["title"],
                slug=payload["slug"],
                scene_type=payload["scene_type"],
                location=payload["location"],
                summary=payload["summary"],
                content=payload["content"],
                notes=payload["notes"],
                characters_json=payload["characters_json"],
                tags_json=payload["tags_json"],
                status=payload["status"],
                order_index=payload["order_index"],
                created_at=datetime.fromisoformat(payload["created_at"]),
                updated_at=datetime.fromisoformat(payload["updated_at"]),
            )
        )

    for payload in snapshot.get("story_references", []):
        session.add(
            StoryReference(
                id=payload["id"],
                project_id=payload["project_id"],
                scene_id=payload["scene_id"],
                reference_kind=payload["reference_kind"],
                target_slug=payload["target_slug"],
                raw_token=payload["raw_token"],
                created_at=datetime.fromisoformat(payload["created_at"]),
            )
        )

    for payload in snapshot.get("assets", []):
        session.add(
            Asset(
                id=payload["id"],
                project_id=payload["project_id"],
                slug=payload["slug"],
                name=payload["name"],
                original_filename=payload["original_filename"],
                mime_type=payload["mime_type"],
                checksum=payload["checksum"],
                size_bytes=payload["size_bytes"],
                storage_path=payload["storage_path"],
                description=payload["description"],
                tags_json=payload["tags_json"],
                status=payload["status"],
                created_at=datetime.fromisoformat(payload["created_at"]),
                updated_at=datetime.fromisoformat(payload["updated_at"]),
                archived_at=datetime.fromisoformat(payload["archived_at"]) if payload["archived_at"] else None,
            )
        )

    for payload in snapshot.get("asset_links", []):
        session.add(
            AssetLink(
                id=payload["id"],
                project_id=payload["project_id"],
                asset_id=payload["asset_id"],
                target_kind=payload["target_kind"],
                target_id=payload["target_id"],
                note=payload["note"],
                created_at=datetime.fromisoformat(payload["created_at"]),
            )
        )

    session.commit()


def create_version(session: Session, project_id: str, payload: VersionCreate) -> Version:
    _project_or_404(session, project_id)
    branch_name = payload.branch_name.strip() or "main"
    latest_index = session.scalar(
        select(func.max(Version.version_index)).where(Version.project_id == project_id, Version.branch_name == branch_name)
    )
    version_index = int(latest_index or 0) + 1
    version = Version(
        id=str(uuid4()),
        project_id=project_id,
        branch_name=branch_name,
        version_index=version_index,
        label=payload.label,
        summary=payload.summary,
        snapshot_json=_serialize_project(session, project_id),
        created_at=datetime.now(UTC),
    )
    session.add(version)
    session.commit()
    session.refresh(version)

    branch_versions = list(
        session.scalars(
            select(Version)
            .where(Version.project_id == project_id, Version.branch_name == branch_name)
            .order_by(Version.version_index.asc())
        )
    )
    if len(branch_versions) > 3:
        for stale_version in branch_versions[:-3]:
            session.delete(stale_version)
        session.commit()
    return version


def list_versions(session: Session, project_id: str) -> list[Version]:
    stmt = select(Version).where(Version.project_id == project_id).order_by(Version.branch_name.asc(), Version.version_index.desc())
    return list(session.scalars(stmt))


def list_branches(session: Session, project_id: str) -> list[VersionBranchRead]:
    versions = list_versions(session, project_id)
    grouped: dict[str, list[Version]] = {}
    for version in versions:
        grouped.setdefault(version.branch_name, []).append(version)
    branches: list[VersionBranchRead] = []
    for branch_name, branch_versions in grouped.items():
        latest = branch_versions[0]
        branches.append(
            VersionBranchRead(
                branch_name=branch_name,
                version_count=len(branch_versions),
                latest_version_id=latest.id,
                latest_created_at=latest.created_at,
            )
        )
    return sorted(branches, key=lambda item: item.branch_name)


def get_version(session: Session, project_id: str, version_id: str) -> Version | None:
    stmt = select(Version).where(Version.project_id == project_id, Version.id == version_id)
    return session.scalar(stmt)


def compare_versions(session: Session, project_id: str, left_version_id: str, right_version_id: str) -> VersionCompareRead:
    left = get_version(session, project_id, left_version_id)
    right = get_version(session, project_id, right_version_id)
    if left is None or right is None:
        raise ValueError("version_not_found")

    left_snapshot = left.snapshot_json
    right_snapshot = right.snapshot_json

    tracked_collections = [
        "characters",
        "relations",
        "voice_samples",
        "tomes",
        "chapters",
        "scenes",
        "story_references",
        "assets",
        "asset_links",
    ]
    left_counts = {key: len(left_snapshot.get(key, [])) for key in tracked_collections}
    right_counts = {key: len(right_snapshot.get(key, [])) for key in tracked_collections}
    counts_delta = {key: right_counts[key] - left_counts[key] for key in left_counts}

    project_changes: list[str] = []
    if left_snapshot.get("project", {}).get("name") != right_snapshot.get("project", {}).get("name"):
        project_changes.append("project.name")
    if left_snapshot.get("project", {}).get("status") != right_snapshot.get("project", {}).get("status"):
        project_changes.append("project.status")

    for key in counts_delta:
        if counts_delta[key] != 0:
            project_changes.append(f"{key}.count")

    return VersionCompareRead(
        left=VersionRead.model_validate(left),
        right=VersionRead.model_validate(right),
        project_changes=project_changes,
        counts_delta=counts_delta,
    )


def restore_version(session: Session, project_id: str, version: Version, label: str | None = None, summary: str | None = None) -> Version:
    snapshot = version.snapshot_json
    _restore_from_snapshot(session, project_id, snapshot)
    restored = create_version(
        session,
        project_id,
        VersionCreate(
            branch_name=version.branch_name,
            label=label or f"Restore {version.branch_name} #{version.version_index}",
            summary=summary if summary is not None else version.summary,
        ),
    )
    return restored
