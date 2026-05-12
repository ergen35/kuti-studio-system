from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from kuti_backend.core.database import get_session
from kuti_backend.core.settings import Settings, get_settings
from kuti_backend.api.errors import (
    EXPORT_ARTIFACT_NOT_AVAILABLE,
    EXPORT_ARTIFACT_NOT_FOUND,
    EXPORT_FORMAT_INVALID,
    EXPORT_NOT_FOUND,
    PROJECT_NOT_FOUND,
    raise_api_error,
)
from kuti_backend.exports.models import ExportFormat, ExportKind, ExportStatus
from kuti_backend.exports.repository import create_export, get_export, list_exports
from kuti_backend.exports.schemas import ExportCreate, ExportRead
from kuti_backend.projects.repository import get_project as get_project_record

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


def _settings(request: Request) -> Settings:
    return getattr(request.app.state, "settings", get_settings())


def _project_or_404(session: Session, project_id: str):
    project = get_project_record(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return project


def _export_or_404(session: Session, project_id: str, export_id: str):
    export = get_export(session, project_id, export_id)
    if export is None:
        raise_api_error(404, EXPORT_NOT_FOUND)
    return export


@router.get("/projects/{project_id}/exports", response_model=list[ExportRead])
def read_exports(
    session: SessionDep,
    project_id: str,
    kind: ExportKind | None = Query(default=None),
    status_filter: ExportStatus | None = Query(default=None, alias="status"),
    format_filter: ExportFormat | None = Query(default=None, alias="format"),
) -> list[ExportRead]:
    _project_or_404(session, project_id)
    items = list_exports(session, project_id, kind=kind, status=status_filter)
    if format_filter is not None:
        items = [item for item in items if item.format == format_filter.value]
    return [ExportRead.model_validate(item) for item in items]


@router.post("/projects/{project_id}/exports", response_model=ExportRead, status_code=status.HTTP_201_CREATED)
def create_export_route(request: Request, session: SessionDep, project_id: str, payload: ExportCreate) -> ExportRead:
    _project_or_404(session, project_id)
    try:
        export = create_export(session, _settings(request), project_id, payload)
        return ExportRead.model_validate(export)
    except ValueError as exc:
        message = str(exc)
        if message.startswith("unsupported export format"):
            raise_api_error(400, EXPORT_FORMAT_INVALID)
        raise_api_error(400, message)


@router.get("/projects/{project_id}/exports/{export_id}", response_model=ExportRead)
def read_export(session: SessionDep, project_id: str, export_id: str) -> ExportRead:
    _project_or_404(session, project_id)
    return ExportRead.model_validate(_export_or_404(session, project_id, export_id))


@router.get("/projects/{project_id}/exports/{export_id}/download")
def download_export(session: SessionDep, project_id: str, export_id: str) -> FileResponse:
    _project_or_404(session, project_id)
    export = _export_or_404(session, project_id, export_id)
    if not export.artifact_path:
        raise_api_error(404, EXPORT_ARTIFACT_NOT_AVAILABLE)

    artifact = Path(export.artifact_path)
    if not artifact.exists():
        raise_api_error(404, EXPORT_ARTIFACT_NOT_FOUND)

    if artifact.is_dir():
        zip_path = artifact.with_suffix(".zip")
        if not zip_path.exists():
            from zipfile import ZIP_DEFLATED, ZipFile

            with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as archive:
                for file_path in artifact.rglob("*"):
                    if file_path.is_file():
                        archive.write(file_path, file_path.relative_to(artifact).as_posix())
        return FileResponse(zip_path, media_type="application/zip", filename=zip_path.name)

    if not artifact.is_file():
        raise_api_error(404, EXPORT_ARTIFACT_NOT_FOUND)

    media_type = "application/zip" if artifact.suffix == ".zip" else "application/json"
    return FileResponse(
        artifact,
        media_type=media_type,
        filename=export.artifact_name or artifact.name,
    )
