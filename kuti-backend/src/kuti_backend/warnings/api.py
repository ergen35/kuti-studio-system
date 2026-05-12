from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from kuti_backend.core.database import get_session
from kuti_backend.api.errors import PROJECT_NOT_FOUND, WARNING_NOT_FOUND, raise_api_error
from kuti_backend.projects.repository import get_project as get_project_record
from kuti_backend.warnings.repository import get_warning, list_warnings, rebuild_warnings, update_warning
from kuti_backend.warnings.schemas import WarningKind, WarningRead, WarningScanResponse, WarningSeverity, WarningStatus, WarningUpdate

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


def _project_or_404(session: Session, project_id: str):
    project = get_project_record(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return project


def _warning_or_404(session: Session, project_id: str, warning_id: str):
    warning = get_warning(session, project_id, warning_id)
    if warning is None:
        raise_api_error(404, WARNING_NOT_FOUND)
    return warning


@router.get("/projects/{project_id}/warnings", response_model=list[WarningRead])
def read_warnings(
    session: SessionDep,
    project_id: str,
    status_filter: WarningStatus | None = Query(default=None, alias="status"),
    kind: WarningKind | None = Query(default=None),
    severity: WarningSeverity | None = Query(default=None),
) -> list[WarningRead]:
    _project_or_404(session, project_id)
    items = list_warnings(session, project_id)
    if status_filter is not None:
        items = [item for item in items if item.status == status_filter.value]
    if kind is not None:
        items = [item for item in items if item.kind == kind.value]
    if severity is not None:
        items = [item for item in items if item.severity == severity.value]
    return [WarningRead.model_validate(item) for item in items]


@router.post("/projects/{project_id}/warnings/scan", response_model=WarningScanResponse)
def scan_warnings(session: SessionDep, project_id: str) -> WarningScanResponse:
    _project_or_404(session, project_id)
    return WarningScanResponse(items=[WarningRead.model_validate(item) for item in rebuild_warnings(session, project_id)])


@router.patch("/projects/{project_id}/warnings/{warning_id}", response_model=WarningRead)
def patch_warning(session: SessionDep, project_id: str, warning_id: str, payload: WarningUpdate) -> WarningRead:
    _project_or_404(session, project_id)
    warning = _warning_or_404(session, project_id, warning_id)
    return WarningRead.model_validate(update_warning(session, warning, payload))
