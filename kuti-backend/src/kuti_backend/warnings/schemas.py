from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class WarningSeverity(StrEnum):
    info = "info"
    warning = "warning"
    critical = "critical"


class WarningStatus(StrEnum):
    open = "open"
    ignored = "ignored"
    resolved = "resolved"


class WarningKind(StrEnum):
    missing_character_reference = "missing_character_reference"
    invalid_location = "invalid_location"
    timeline_incoherence = "timeline_incoherence"
    orphan_reference = "orphan_reference"


class WarningRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    fingerprint: str
    kind: WarningKind
    severity: WarningSeverity
    status: WarningStatus
    title: str
    message: str
    entity_kind: str
    entity_id: str
    metadata_json: dict
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None


class WarningUpdate(BaseModel):
    status: WarningStatus
    note: str | None = Field(default=None, max_length=500)


class WarningScanResponse(BaseModel):
    items: list[WarningRead]
