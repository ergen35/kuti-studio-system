from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from kuti_backend.exports.models import ExportFormat, ExportKind, ExportStatus


class ExportCreate(BaseModel):
    kind: ExportKind = ExportKind.work
    format: ExportFormat = ExportFormat.json
    label: str | None = Field(default=None, max_length=255)
    summary: str = Field(default="", max_length=2000)


class ExportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    kind: ExportKind
    format: ExportFormat
    status: ExportStatus
    label: str
    summary: str
    artifact_path: str | None = None
    artifact_name: str | None = None
    metadata_json: dict
    size_bytes: int | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    error_message: str | None = None
