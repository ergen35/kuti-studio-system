from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from kuti_backend.projects.models import Base, utcnow


class GenerationSourceKind(StrEnum):
    scene = "scene"
    chapter = "chapter"
    tome = "tome"
    panel = "panel"


class GenerationStrategy(StrEnum):
    direct = "direct"
    intermediate = "intermediate"


class GenerationJobStatus(StrEnum):
    pending = "pending"
    running = "running"
    ready = "ready"
    validated = "validated"
    failed = "failed"


class GenerationStepStatus(StrEnum):
    pending = "pending"
    running = "running"
    ready = "ready"
    failed = "failed"


class GenerationBoardStatus(StrEnum):
    draft = "draft"
    validated = "validated"


class GenerationPanelStatus(StrEnum):
    draft = "draft"
    selected = "selected"
    rejected = "rejected"
    replaced = "replaced"


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    source_kind: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    source_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    source_label: Mapped[str] = mapped_column(String(255), nullable=False)
    source_version_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    strategy: Mapped[str] = mapped_column(String(32), index=True, nullable=False, default=GenerationStrategy.direct.value)
    entrypoint: Mapped[str] = mapped_column(String(64), nullable=False, default="gpt-2-images")
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Generation job")
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), index=True, nullable=False, default=GenerationJobStatus.pending.value)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class GenerationJobStep(Base):
    __tablename__ = "generation_job_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), index=True, nullable=False, default=GenerationStepStatus.pending.value)
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    output_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    artifact_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class GenerationBoard(Base):
    __tablename__ = "generation_boards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    job_id: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    source_kind: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    strategy: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), index=True, nullable=False, default=GenerationBoardStatus.draft.value)
    artifact_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GenerationBoardPanel(Base):
    __tablename__ = "generation_board_panels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    board_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    step_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    caption: Mapped[str] = mapped_column(Text, nullable=False, default="")
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), index=True, nullable=False, default=GenerationPanelStatus.draft.value)
    image_path: Mapped[str] = mapped_column(Text, nullable=False)
    image_name: Mapped[str] = mapped_column(String(255), nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
