from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from shutil import copytree
from uuid import uuid4

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from kuti_backend.core.settings import Settings
from kuti_backend.projects.models import Project, ProjectStatus
from kuti_backend.projects.schemas import ProjectClone, ProjectCreate, ProjectUpdate


def slugify(value: str) -> str:
    import re

    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return slug or "project"


def project_root(settings: Settings, slug: str) -> Path:
    return settings.project_data_dir / slug


def project_json_path(settings: Settings, slug: str) -> Path:
    return project_root(settings, slug) / "project.json"


def serialize_project(project: Project) -> dict[str, object]:
    return {
        "id": project.id,
        "name": project.name,
        "slug": project.slug,
        "status": project.status,
        "rootPath": project.root_path,
        "settingsJson": project.settings_json,
        "createdAt": project.created_at.isoformat(),
        "updatedAt": project.updated_at.isoformat(),
        "lastOpenedAt": project.last_opened_at.isoformat() if project.last_opened_at else None,
        "archivedAt": project.archived_at.isoformat() if project.archived_at else None,
    }


def write_project_file(settings: Settings, project: Project) -> None:
    path = project_json_path(settings, project.slug)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(serialize_project(project), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _unique_slug(session: Session, base_slug: str) -> str:
    candidate = base_slug
    index = 2
    while session.scalar(select(Project).where(Project.slug == candidate)) is not None:
        candidate = f"{base_slug}-{index}"
        index += 1
    return candidate


def list_projects(session: Session) -> list[Project]:
    stmt = select(Project).order_by(desc(Project.last_opened_at), desc(Project.updated_at))
    return list(session.scalars(stmt))


def get_project(session: Session, project_id: str) -> Project | None:
    return session.get(Project, project_id)


def create_project(session: Session, settings: Settings, payload: ProjectCreate) -> Project:
    base_slug = slugify(payload.name)
    slug = _unique_slug(session, base_slug)
    root = project_root(settings, slug)
    root.mkdir(parents=True, exist_ok=True)
    project = Project(
        id=str(uuid4()),
        name=payload.name,
        slug=slug,
        status=payload.status.value,
        root_path=str(root),
        settings_json=payload.settings_json,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    write_project_file(settings, project)
    return project


def update_project(session: Session, settings: Settings, project: Project, payload: ProjectUpdate) -> Project:
    if payload.name is not None and payload.name != project.name:
        project.name = payload.name
    if payload.status is not None:
        project.status = payload.status.value
    if payload.settings_json is not None:
        project.settings_json = payload.settings_json
    project.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(project)
    write_project_file(settings, project)
    return project


def archive_project(session: Session, settings: Settings, project: Project) -> Project:
    project.status = ProjectStatus.archived.value
    project.archived_at = datetime.now(UTC)
    project.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(project)
    write_project_file(settings, project)
    return project


def open_project(session: Session, settings: Settings, project: Project) -> Project:
    project.last_opened_at = datetime.now(UTC)
    project.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(project)
    write_project_file(settings, project)
    return project


def touch_project(session: Session, settings: Settings, project: Project) -> Project:
    return open_project(session, settings, project)


def clone_project(session: Session, settings: Settings, project: Project, payload: ProjectClone) -> Project:
    clone_name = payload.name or f"{project.name} Copy"
    clone_slug = _unique_slug(session, slugify(clone_name))
    clone_root = project_root(settings, clone_slug)
    source_root = Path(project.root_path)
    if source_root.exists():
        copytree(source_root, clone_root, dirs_exist_ok=False)
    else:
        clone_root.mkdir(parents=True, exist_ok=True)
    clone = Project(
        id=str(uuid4()),
        name=clone_name,
        slug=clone_slug,
        status=ProjectStatus.draft.value,
        root_path=str(clone_root),
        settings_json=dict(project.settings_json),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(clone)
    session.commit()
    session.refresh(clone)
    write_project_file(settings, clone)
    return clone


def export_project(project: Project) -> dict[str, object]:
    return serialize_project(project)
