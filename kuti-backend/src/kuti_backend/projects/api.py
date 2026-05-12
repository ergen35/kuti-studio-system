from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from kuti_backend.core.database import get_session
from kuti_backend.core.settings import Settings, get_settings
from kuti_backend.api.errors import PROJECT_NOT_FOUND, raise_api_error
from kuti_backend.projects.repository import (
    archive_project,
    clone_project,
    create_project,
    export_project,
    get_project,
    list_projects,
    open_project,
    update_project,
)
from kuti_backend.warnings.repository import rebuild_warnings
from kuti_backend.projects.schemas import (
    ProjectClone,
    ProjectCreate,
    ProjectListResponse,
    ProjectRead,
    ProjectUpdate,
)

router = APIRouter()


def current_settings(request: Request) -> Settings:
    return getattr(request.app.state, "settings", get_settings())


SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/projects", response_model=ProjectListResponse)
def read_projects(session: SessionDep) -> ProjectListResponse:
    return ProjectListResponse(items=list_projects(session))


@router.post("/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project_route(request: Request, session: SessionDep, payload: ProjectCreate) -> ProjectRead:
    project = create_project(session, current_settings(request), payload)
    return project


@router.get("/projects/{project_id}", response_model=ProjectRead)
def read_project(request: Request, session: SessionDep, project_id: str) -> ProjectRead:
    project = get_project(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return project


@router.patch("/projects/{project_id}", response_model=ProjectRead)
def patch_project(request: Request, session: SessionDep, project_id: str, payload: ProjectUpdate) -> ProjectRead:
    project = get_project(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    updated = update_project(session, current_settings(request), project, payload)
    rebuild_warnings(session, project_id)
    return updated


@router.post("/projects/{project_id}/archive", response_model=ProjectRead)
def archive_project_route(request: Request, session: SessionDep, project_id: str) -> ProjectRead:
    project = get_project(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return archive_project(session, current_settings(request), project)


@router.post("/projects/{project_id}/clone", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def clone_project_route(
    request: Request,
    session: SessionDep,
    project_id: str,
    payload: ProjectClone,
) -> ProjectRead:
    project = get_project(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return clone_project(session, current_settings(request), project, payload)


@router.post("/projects/{project_id}/open", response_model=ProjectRead)
def open_project_route(request: Request, session: SessionDep, project_id: str) -> ProjectRead:
    project = get_project(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return open_project(session, current_settings(request), project)


@router.get("/projects/{project_id}/export")
def export_project_route(session: SessionDep, project_id: str) -> dict[str, object]:
    project = get_project(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return export_project(project)
