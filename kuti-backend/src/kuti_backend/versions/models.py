from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from kuti_backend.projects.models import Base, utcnow


class Version(Base):
    __tablename__ = "versions"
    __table_args__ = (UniqueConstraint("project_id", "branch_name", "version_index", name="uq_versions_branch_index"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    branch_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False, default="main")
    version_index: Mapped[int] = mapped_column(nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False, default="Checkpoint")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    snapshot_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
