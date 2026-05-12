from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Request

from kuti_backend.assets.api import router as assets_router
from kuti_backend.characters.api import router as characters_router
from kuti_backend.exports.api import router as exports_router
from kuti_backend.core.settings import get_settings
from kuti_backend.generation.api import router as generation_router
from kuti_backend.generation.schemas import ModelProviderRead
from kuti_backend.projects.api import router as projects_router
from kuti_backend.story.api import router as story_router
from kuti_backend.versions.api import router as versions_router
from kuti_backend.warnings.api import router as warnings_router

router = APIRouter()
router.include_router(projects_router)
router.include_router(assets_router)
router.include_router(characters_router)
router.include_router(exports_router)
router.include_router(generation_router)
router.include_router(story_router)
router.include_router(versions_router)
router.include_router(warnings_router)


def _settings(request: Request):
    return getattr(request.app.state, "settings", get_settings())


@router.get("/health")
def health(request: Request) -> dict[str, object]:
    settings = _settings(request)
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "timestamp": datetime.now(UTC).isoformat(),
        "dataDir": str(settings.data_dir),
    }


@router.get("/config")
def config(request: Request) -> dict[str, object]:
    settings = _settings(request)
    return {
        "appName": settings.app_name,
        "appVersion": settings.app_version,
        "environment": settings.environment,
        "locale": settings.locale,
        "dataDir": str(settings.data_dir),
        "projectDataDir": str(settings.project_data_dir),
        "exportsDir": str(settings.exports_dir),
        "openapiUrl": settings.openapi_path,
    }


@router.get("/models", response_model=list[ModelProviderRead])
def models(request: Request) -> list[ModelProviderRead]:
    settings = _settings(request)
    return [ModelProviderRead.model_validate(item) for item in settings.model_providers]
