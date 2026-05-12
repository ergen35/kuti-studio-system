from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from kuti_backend.api.routes import router
from kuti_backend.core.database import init_database
from kuti_backend.core.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url=settings.openapi_path,
    )
    app.state.settings = settings
    app.state.engine = init_database(settings)
    if settings.trusted_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.trusted_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    app.include_router(router, prefix="/api")
    return app


app = create_app()
