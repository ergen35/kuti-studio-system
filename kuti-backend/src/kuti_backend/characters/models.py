from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from kuti_backend.projects.models import Base, utcnow


class Character(Base):
    __tablename__ = "characters"
    __table_args__ = (UniqueConstraint("project_id", "slug", name="uq_characters_project_slug"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    alias: Mapped[str | None] = mapped_column(String(255), nullable=True)
    narrative_role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    physical_description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    color_palette_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    costume_elements_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    key_traits_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    personality: Mapped[str] = mapped_column(Text, nullable=False, default="")
    narrative_arc: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CharacterRelation(Base):
    __tablename__ = "character_relations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    source_character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), index=True, nullable=False)
    target_character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), index=True, nullable=False)
    relation_type: Mapped[str] = mapped_column(String(64), nullable=False)
    strength: Mapped[int] = mapped_column(nullable=False, default=50)
    narrative_dependency: Mapped[str] = mapped_column(Text, nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class VoiceSample(Base):
    __tablename__ = "voice_samples"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), index=True, nullable=False)
    asset_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    voice_notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class CharacterImage(Base):
    """Stores generated images for a character."""

    __tablename__ = "character_images"
    __table_args__ = (UniqueConstraint("character_id", "file_name", name="uq_character_images_file_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey("characters.id"), index=True, nullable=False)
    board_panel_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("generation_board_panels.id"), index=True, nullable=True)

    # File info
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(64), default="image/png")

    # Generation metadata
    prompt: Mapped[str] = mapped_column(Text, default="")
    strategy: Mapped[str | None] = mapped_column(String(32), nullable=True)  # portrait/full_body/concept
    style: Mapped[str | None] = mapped_column(String(32), nullable=True)  # realistic/anime/...
    variation_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
