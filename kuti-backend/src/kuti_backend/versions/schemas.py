from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VersionCreate(BaseModel):
    branch_name: str = Field(default="main", max_length=255)
    label: str = Field(default="Checkpoint", max_length=255)
    summary: str = ""


class VersionRestoreRequest(BaseModel):
    label: str | None = Field(default=None, max_length=255)
    summary: str | None = None


class VersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    branch_name: str
    version_index: int
    label: str
    summary: str
    created_at: datetime


class VersionBranchRead(BaseModel):
    branch_name: str
    version_count: int
    latest_version_id: str | None = None
    latest_created_at: datetime | None = None


class VersionCompareRequest(BaseModel):
    left_version_id: str
    right_version_id: str


class VersionCompareRead(BaseModel):
    left: VersionRead
    right: VersionRead
    project_changes: list[str] = Field(default_factory=list)
    counts_delta: dict[str, int] = Field(default_factory=dict)
