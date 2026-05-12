from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from fastapi import Request
from sqlalchemy.orm import Session

from kuti_backend.assets.models import Asset, AssetLink
from kuti_backend.assets.repository import (
    archive_asset,
    asset_usage_summary,
    create_asset_link,
    delete_asset,
    delete_asset_link,
    get_asset,
    import_asset,
    list_asset_links,
    list_assets,
    update_asset,
)
from kuti_backend.assets.schemas import (
    AssetDetail,
    AssetImport,
    AssetLinkCreate,
    AssetLinkRead,
    AssetListResponse,
    AssetRead,
    AssetUpdate,
)
from kuti_backend.api.errors import (
    ASSET_ID_MUST_MATCH_ROUTE_ASSET,
    ASSET_LINK_NOT_FOUND,
    ASSET_LINK_TARGET_NOT_FOUND,
    ASSET_NOT_FOUND,
    ASSET_SOURCE_MISSING,
    PROJECT_NOT_FOUND,
    raise_api_error,
)
from kuti_backend.core.database import get_session
from kuti_backend.core.settings import Settings, get_settings
from kuti_backend.projects.repository import get_project as get_project_record

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


def _settings(request):
    return getattr(request.app.state, "settings", get_settings())


def _project_or_404(session: Session, project_id: str):
    project = get_project_record(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return project


def _asset_or_404(session: Session, project_id: str, asset_id: str):
    asset = get_asset(session, project_id, asset_id)
    if asset is None:
        raise_api_error(404, ASSET_NOT_FOUND)
    return asset


def _link_or_404(session: Session, project_id: str, link_id: str):
    link = session.get(AssetLink, link_id)
    if link is None or link.project_id != project_id:
        raise_api_error(404, ASSET_LINK_NOT_FOUND)
    return link


@router.get("/projects/{project_id}/assets", response_model=AssetListResponse)
def read_assets(session: SessionDep, project_id: str) -> AssetListResponse:
    _project_or_404(session, project_id)
    return AssetListResponse(items=list_assets(session, project_id))


@router.post("/projects/{project_id}/assets/import", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
def import_asset_route(request: Request, session: SessionDep, project_id: str, payload: AssetImport) -> AssetRead:
    _project_or_404(session, project_id)
    try:
        return import_asset(session, _settings(request), project_id, payload)
    except ValueError as exc:
        message = str(exc)
        if message == ASSET_SOURCE_MISSING:
            raise_api_error(404, ASSET_SOURCE_MISSING)
        raise HTTPException(status_code=409, detail=message) from exc


@router.get("/projects/{project_id}/assets/{asset_id}", response_model=AssetDetail)
def read_asset(session: SessionDep, project_id: str, asset_id: str) -> AssetDetail:
    _project_or_404(session, project_id)
    asset = _asset_or_404(session, project_id, asset_id)
    return AssetDetail(
        **AssetRead.model_validate(asset).model_dump(),
        links=[AssetLinkRead.model_validate(link) for link in asset_usage_summary(session, project_id, asset_id)],
    )


@router.patch("/projects/{project_id}/assets/{asset_id}", response_model=AssetRead)
def update_asset_route(session: SessionDep, project_id: str, asset_id: str, payload: AssetUpdate) -> AssetRead:
    _project_or_404(session, project_id)
    asset = _asset_or_404(session, project_id, asset_id)
    return update_asset(session, asset, payload)


@router.post("/projects/{project_id}/assets/{asset_id}/archive", response_model=AssetRead)
def archive_asset_route(session: SessionDep, project_id: str, asset_id: str) -> AssetRead:
    _project_or_404(session, project_id)
    asset = _asset_or_404(session, project_id, asset_id)
    return archive_asset(session, asset)


@router.delete("/projects/{project_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset_route(session: SessionDep, project_id: str, asset_id: str) -> None:
    _project_or_404(session, project_id)
    asset = _asset_or_404(session, project_id, asset_id)
    delete_asset(session, asset)


@router.get("/projects/{project_id}/assets/{asset_id}/file")
def read_asset_file(session: SessionDep, project_id: str, asset_id: str):
    _project_or_404(session, project_id)
    asset = _asset_or_404(session, project_id, asset_id)
    return FileResponse(asset.storage_path, media_type=asset.mime_type, filename=asset.original_filename)


@router.get("/projects/{project_id}/assets/{asset_id}/links", response_model=list[AssetLinkRead])
def read_asset_links(session: SessionDep, project_id: str, asset_id: str) -> list[AssetLinkRead]:
    _project_or_404(session, project_id)
    _asset_or_404(session, project_id, asset_id)
    return [AssetLinkRead.model_validate(link) for link in list_asset_links(session, project_id, asset_id=asset_id)]


@router.post("/projects/{project_id}/assets/{asset_id}/links", response_model=AssetLinkRead, status_code=status.HTTP_201_CREATED)
def create_asset_link_route(session: SessionDep, project_id: str, asset_id: str, payload: AssetLinkCreate) -> AssetLinkRead:
    _project_or_404(session, project_id)
    _asset_or_404(session, project_id, asset_id)
    if payload.asset_id != asset_id:
        raise_api_error(400, ASSET_ID_MUST_MATCH_ROUTE_ASSET)
    try:
        return create_asset_link(session, project_id, payload)
    except ValueError as exc:
        message = str(exc)
        if message == "asset_not_found":
            raise_api_error(404, ASSET_NOT_FOUND)
        if message == "asset_link_target_not_found":
            raise_api_error(404, ASSET_LINK_TARGET_NOT_FOUND)
        raise HTTPException(status_code=409, detail=message) from exc


@router.delete("/projects/{project_id}/assets/{asset_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset_link_route(session: SessionDep, project_id: str, asset_id: str, link_id: str) -> None:
    _project_or_404(session, project_id)
    link = _link_or_404(session, project_id, link_id)
    if link.asset_id != asset_id:
        raise_api_error(404, ASSET_LINK_NOT_FOUND)
    delete_asset_link(session, link)
