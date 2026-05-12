from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from kuti_backend.projects.models import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    settings_json: dict = Field(default_factory=dict)


class ProjectCreate(ProjectBase):
    status: ProjectStatus = ProjectStatus.draft


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    status: ProjectStatus | None = None
    settings_json: dict | None = None


class ProjectClone(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    status: ProjectStatus
    root_path: str
    settings_json: dict
    created_at: datetime
    updated_at: datetime
    last_opened_at: datetime | None = None
    archived_at: datetime | None = None


class ProjectListResponse(BaseModel):
    items: list[ProjectRead]
