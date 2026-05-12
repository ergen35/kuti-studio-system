from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from kuti_backend.projects.models import Base, utcnow


class ExportKind(StrEnum):
    work = "work"
    publication = "publication"


class ExportFormat(StrEnum):
    json = "json"
    tree = "tree"
    zip = "zip"


class ExportStatus(StrEnum):
    pending = "pending"
    ready = "ready"
    failed = "failed"


class Export(Base):
    __tablename__ = "exports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), index=True, nullable=False, default=ExportKind.work.value)
    format: Mapped[str] = mapped_column(String(32), index=True, nullable=False, default=ExportFormat.json.value)
    status: Mapped[str] = mapped_column(String(32), index=True, nullable=False, default=ExportStatus.pending.value)
    label: Mapped[str] = mapped_column(String(255), nullable=False, default="Export")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    artifact_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    size_bytes: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
