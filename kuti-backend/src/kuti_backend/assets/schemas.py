from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class AssetStatus(StrEnum):
    active = "active"
    archived = "archived"


class AssetImport(BaseModel):
    source_path: str = Field(min_length=1)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    description: str = ""
    tags_json: list[str] = Field(default_factory=list)
    mime_type: str | None = Field(default=None, max_length=255)


class AssetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    tags_json: list[str] | None = None
    status: AssetStatus | None = None


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    slug: str
    name: str
    original_filename: str
    mime_type: str
    checksum: str
    size_bytes: int
    storage_path: str
    description: str
    tags_json: list[str]
    status: AssetStatus
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None


class AssetLinkCreate(BaseModel):
    asset_id: str
    target_kind: str = Field(min_length=1, max_length=64)
    target_id: str = Field(min_length=1, max_length=36)
    note: str = ""


class AssetLinkUpdate(BaseModel):
    note: str | None = None


class AssetLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    asset_id: str
    target_kind: str
    target_id: str
    note: str
    created_at: datetime


class AssetDetail(AssetRead):
    links: list[AssetLinkRead] = Field(default_factory=list)


class AssetListResponse(BaseModel):
    items: list[AssetRead]
