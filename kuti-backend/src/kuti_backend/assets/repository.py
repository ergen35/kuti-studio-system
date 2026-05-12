from __future__ import annotations

import hashlib
import mimetypes
import re
from datetime import UTC, datetime
from pathlib import Path
from shutil import copy2
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from kuti_backend.assets.models import Asset, AssetLink
from kuti_backend.assets.schemas import AssetImport, AssetLinkCreate, AssetStatus, AssetUpdate
from kuti_backend.characters.models import Character
from kuti_backend.core.settings import Settings
from kuti_backend.projects.models import Project
from kuti_backend.story.models import Chapter, Scene, Tome


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return slug or "asset"


def _normalize_list(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        item = value.strip()
        if item and item not in seen:
            seen.add(item)
            result.append(item)
    return result


def _project_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError("project_not_found")
    return project


def _resolve_asset_link_target(session: Session, project_id: str, target_kind: str, target_id: str):
    kind = target_kind.lower().strip()
    if kind == "character":
        return session.get(Character, target_id) if session.get(Character, target_id) and session.get(Character, target_id).project_id == project_id else None
    if kind == "tome":
        return session.get(Tome, target_id) if session.get(Tome, target_id) and session.get(Tome, target_id).project_id == project_id else None
    if kind == "chapter":
        return session.get(Chapter, target_id) if session.get(Chapter, target_id) and session.get(Chapter, target_id).project_id == project_id else None
    if kind == "scene":
        return session.get(Scene, target_id) if session.get(Scene, target_id) and session.get(Scene, target_id).project_id == project_id else None
    return None


def _unique_slug(session: Session, project_id: str, base_slug: str, ignore_id: str | None = None) -> str:
    candidate = base_slug
    index = 2
    while True:
        stmt = select(Asset.id).where(Asset.project_id == project_id, Asset.slug == candidate)
        if ignore_id is not None:
            stmt = stmt.where(Asset.id != ignore_id)
        if session.scalar(stmt) is None:
            return candidate
        candidate = f"{base_slug}-{index}"
        index += 1


def _project_assets_dir(project: Project) -> Path:
    path = Path(project.root_path) / "assets"
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_assets(session: Session, project_id: str) -> list[Asset]:
    stmt = select(Asset).where(Asset.project_id == project_id).order_by(Asset.updated_at.desc(), Asset.name.asc())
    return list(session.scalars(stmt))


def get_asset(session: Session, project_id: str, asset_id: str) -> Asset | None:
    stmt = select(Asset).where(Asset.project_id == project_id, Asset.id == asset_id)
    return session.scalar(stmt)


def get_asset_by_slug(session: Session, project_id: str, slug: str) -> Asset | None:
    stmt = select(Asset).where(Asset.project_id == project_id, Asset.slug == slug)
    return session.scalar(stmt)


def import_asset(session: Session, settings: Settings, project_id: str, payload: AssetImport) -> Asset:
    project = _project_or_404(session, project_id)
    source = Path(payload.source_path).expanduser()
    if not source.is_file():
        raise ValueError("asset_source_missing")

    data = source.read_bytes()
    checksum = hashlib.sha256(data).hexdigest()
    slug = _unique_slug(session, project_id, slugify(payload.slug or payload.name or source.stem))
    name = payload.name or source.stem
    mime_type = payload.mime_type or mimetypes.guess_type(source.name)[0] or "application/octet-stream"

    storage_dir = _project_assets_dir(project)
    storage_name = f"{slug}-{checksum[:12]}{source.suffix.lower()}"
    storage_path = storage_dir / storage_name
    copy2(source, storage_path)

    asset = Asset(
        id=str(uuid4()),
        project_id=project_id,
        slug=slug,
        name=name,
        original_filename=source.name,
        mime_type=mime_type,
        checksum=checksum,
        size_bytes=len(data),
        storage_path=str(storage_path),
        description=payload.description,
        tags_json=_normalize_list(payload.tags_json),
        status=AssetStatus.active.value,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset


def update_asset(session: Session, asset: Asset, payload: AssetUpdate) -> Asset:
    if payload.name is not None:
        asset.name = payload.name
    if payload.slug is not None:
        asset.slug = _unique_slug(session, asset.project_id, slugify(payload.slug), ignore_id=asset.id)
    if payload.description is not None:
        asset.description = payload.description
    if payload.tags_json is not None:
        asset.tags_json = _normalize_list(payload.tags_json)
    if payload.status is not None:
        asset.status = payload.status.value
        asset.archived_at = datetime.now(UTC) if payload.status == AssetStatus.archived else None
    asset.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(asset)
    return asset


def archive_asset(session: Session, asset: Asset) -> Asset:
    asset.status = AssetStatus.archived.value
    asset.archived_at = datetime.now(UTC)
    asset.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(asset)
    return asset


def delete_asset(session: Session, asset: Asset) -> None:
    try:
        Path(asset.storage_path).unlink(missing_ok=True)
    except OSError:
        pass
    session.execute(delete(AssetLink).where(AssetLink.asset_id == asset.id))
    session.delete(asset)
    session.commit()


def list_asset_links(session: Session, project_id: str, asset_id: str | None = None, target_kind: str | None = None, target_id: str | None = None) -> list[AssetLink]:
    stmt = select(AssetLink).where(AssetLink.project_id == project_id)
    if asset_id is not None:
        stmt = stmt.where(AssetLink.asset_id == asset_id)
    if target_kind is not None:
        stmt = stmt.where(AssetLink.target_kind == target_kind)
    if target_id is not None:
        stmt = stmt.where(AssetLink.target_id == target_id)
    stmt = stmt.order_by(AssetLink.created_at.asc())
    return list(session.scalars(stmt))


def create_asset_link(session: Session, project_id: str, payload: AssetLinkCreate) -> AssetLink:
    asset = get_asset(session, project_id, payload.asset_id)
    if asset is None:
        raise ValueError("asset_not_found")
    if _resolve_asset_link_target(session, project_id, payload.target_kind, payload.target_id) is None:
        raise ValueError("asset_link_target_not_found")
    link = AssetLink(
        id=str(uuid4()),
        project_id=project_id,
        asset_id=payload.asset_id,
        target_kind=payload.target_kind,
        target_id=payload.target_id,
        note=payload.note,
        created_at=datetime.now(UTC),
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


def delete_asset_link(session: Session, link: AssetLink) -> None:
    session.delete(link)
    session.commit()


def asset_usage_summary(session: Session, project_id: str, asset_id: str) -> list[AssetLink]:
    return list_asset_links(session, project_id, asset_id=asset_id)
