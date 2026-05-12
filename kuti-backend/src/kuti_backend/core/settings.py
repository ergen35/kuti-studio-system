from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from kuti_backend.core.paths import default_data_dir


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="KUTI_",
        extra="ignore",
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
    )

    app_name: str = "Kuti Studio Backend"
    app_version: str = "0.1.0"
    environment: str = Field(default="development")
    locale: str = Field(default="en")
    data_dir: Path = Field(default_factory=default_data_dir)
    trusted_origins_raw: str = Field(default="", validation_alias="TRUSTED_ORIGINS")

    @property
    def project_data_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def exports_dir(self) -> Path:
        return self.data_dir / "exports"

    @property
    def generation_dir(self) -> Path:
        return self.data_dir / "generation"

    @property
    def openapi_path(self) -> str:
        return "/api/openapi.json"

    @property
    def trusted_origins(self) -> list[str]:
        return [origin.strip() for origin in self.trusted_origins_raw.split(",") if origin.strip()]

    # Model provider configuration
    sora_2_base_url: str | None = None
    sora_2_api_key: str | None = None
    sora_2_enabled: bool = True

    seedance_2_base_url: str | None = None
    seedance_2_api_key: str | None = None
    seedance_2_enabled: bool = True

    gpt_images_1_5_base_url: str | None = None
    gpt_images_1_5_api_key: str | None = None
    gpt_images_1_5_enabled: bool = True

    gpt_images_2_base_url: str | None = None
    gpt_images_2_api_key: str | None = None
    gpt_images_2_enabled: bool = True

    eleven_labs_base_url: str | None = None
    eleven_labs_api_key: str | None = None
    eleven_labs_enabled: bool = True

    @property
    def model_providers(self) -> list[dict[str, object]]:
        from kuti_backend.generation.providers import public_model_catalog

        return public_model_catalog(self)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.project_data_dir.mkdir(parents=True, exist_ok=True)
    settings.exports_dir.mkdir(parents=True, exist_ok=True)
    settings.generation_dir.mkdir(parents=True, exist_ok=True)
    return settings
