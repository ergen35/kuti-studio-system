from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from kuti_backend.generation.models import GenerationSourceKind


class ModelProviderRead(BaseModel):
    key: str
    kind: str
    display_name: str
    base_url: str | None = None
    enabled: bool
    configured: bool
    has_api_key: bool


class GenerationJobCreate(BaseModel):
    source_kind: GenerationSourceKind
    source_id: str
    source_version_id: str | None = None
    strategy: str = Field(default="direct")
    model_key: str | None = None
    mode: str = Field(default="separate")
    selection_ids: list[str] = Field(default_factory=list)
    grid_rows: int | None = None
    grid_cols: int | None = None
    image_count: int | None = None
    title: str | None = None
    summary: str = ""


class GenerationJobStepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_id: str
    order_index: int
    title: str
    status: str
    prompt: str
    output_text: str
    artifact_path: str | None
    artifact_name: str | None
    metadata_json: dict[str, object]
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    failed_at: datetime | None
    error_message: str | None


class GenerationPanelUpdate(BaseModel):
    status: str | None = None
    caption: str | None = Field(default=None, max_length=4000)
    title: str | None = Field(default=None, max_length=255)


class GenerationBoardPanelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    board_id: str
    step_id: str | None
    order_index: int
    title: str
    caption: str
    prompt: str
    status: str
    image_path: str
    image_name: str
    metadata_json: dict[str, object]
    created_at: datetime
    updated_at: datetime


class GenerationBoardValidateRequest(BaseModel):
    note: str | None = Field(default=None, max_length=4000)


class GenerationBoardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    job_id: str
    source_kind: GenerationSourceKind
    strategy: str
    title: str
    summary: str
    status: str
    artifact_path: str | None
    artifact_name: str | None
    metadata_json: dict[str, object]
    created_at: datetime
    updated_at: datetime
    validated_at: datetime | None
    panels: list[GenerationBoardPanelRead] = Field(default_factory=list)


class GenerationJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    source_kind: GenerationSourceKind
    source_id: str
    source_label: str
    source_version_id: str | None
    strategy: str
    model_key: str | None = None
    model_name: str | None = None
    model_kind: str | None = None
    entrypoint: str
    title: str
    prompt: str
    summary: str
    status: str
    progress: int
    metadata_json: dict[str, object]
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    failed_at: datetime | None
    error_message: str | None
    steps: list[GenerationJobStepRead] = Field(default_factory=list)
    board: GenerationBoardRead | None = None
