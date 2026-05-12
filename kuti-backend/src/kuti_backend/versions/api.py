from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from kuti_backend.core.database import get_session
from kuti_backend.api.errors import PROJECT_NOT_FOUND, VERSION_NOT_FOUND, raise_api_error
from kuti_backend.projects.repository import get_project as get_project_record
from kuti_backend.versions.repository import (
    compare_versions,
    create_version,
    get_version,
    list_branches,
    list_versions,
    restore_version,
)
from kuti_backend.versions.schemas import (
    VersionBranchRead,
    VersionCompareRead,
    VersionCompareRequest,
    VersionCreate,
    VersionRead,
    VersionRestoreRequest,
)

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


def _project_or_404(session: Session, project_id: str):
    project = get_project_record(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return project


def _version_or_404(session: Session, project_id: str, version_id: str):
    version = get_version(session, project_id, version_id)
    if version is None:
        raise_api_error(404, VERSION_NOT_FOUND)
    return version


@router.get("/projects/{project_id}/versions", response_model=list[VersionRead])
def read_versions(session: SessionDep, project_id: str) -> list[VersionRead]:
    _project_or_404(session, project_id)
    return [VersionRead.model_validate(version) for version in list_versions(session, project_id)]


@router.get("/projects/{project_id}/versions/branches", response_model=list[VersionBranchRead])
def read_version_branches(session: SessionDep, project_id: str) -> list[VersionBranchRead]:
    _project_or_404(session, project_id)
    return list_branches(session, project_id)


@router.post("/projects/{project_id}/versions", response_model=VersionRead, status_code=status.HTTP_201_CREATED)
def create_version_route(session: SessionDep, project_id: str, payload: VersionCreate) -> VersionRead:
    try:
        return create_version(session, project_id, payload)
    except ValueError as exc:
        message = str(exc)
        if message == "project_not_found":
            raise_api_error(404, PROJECT_NOT_FOUND)
        raise_api_error(404, VERSION_NOT_FOUND)


@router.get("/projects/{project_id}/versions/{version_id}", response_model=VersionRead)
def read_version(session: SessionDep, project_id: str, version_id: str) -> VersionRead:
    _project_or_404(session, project_id)
    return VersionRead.model_validate(_version_or_404(session, project_id, version_id))


@router.post("/projects/{project_id}/versions/compare", response_model=VersionCompareRead)
def compare_versions_route(session: SessionDep, project_id: str, payload: VersionCompareRequest) -> VersionCompareRead:
    _project_or_404(session, project_id)
    try:
        return compare_versions(session, project_id, payload.left_version_id, payload.right_version_id)
    except ValueError as exc:
        raise_api_error(404, VERSION_NOT_FOUND)


@router.post("/projects/{project_id}/versions/{version_id}/restore", response_model=VersionRead, status_code=status.HTTP_201_CREATED)
def restore_version_route(
    session: SessionDep,
    project_id: str,
    version_id: str,
    payload: VersionRestoreRequest | None = Body(default=None),
) -> VersionRead:
    _project_or_404(session, project_id)
    version = _version_or_404(session, project_id, version_id)
    try:
        restored = restore_version(
            session,
            project_id,
            version,
            label=payload.label if payload is not None else None,
            summary=payload.summary if payload is not None else None,
        )
        return VersionRead.model_validate(restored)
    except ValueError as exc:
        raise_api_error(404, VERSION_NOT_FOUND)
