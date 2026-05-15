"""Models for scene generation configuration and manga page generation."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, JSON, String, Text, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from kuti_backend.projects.models import Base, utcnow


class StylePreset(StrEnum):
    """Manga style presets."""
    shonen = "shonen"
    shojo = "shojo"
    seinen = "seinen"
    generic = "generic"


class ColorMode(StrEnum):
    """Color modes for manga generation."""
    bw = "bw"
    color = "color"
    spot_color = "spot_color"


class SceneGenerationConfig(Base):
    """Configuration preset for scene-to-manga generation.
    
    Each project can have multiple configs (e.g., "Manga BW", "Manga Color", "Webtoon")
    with one marked as default.
    """
    
    __tablename__ = "scene_generation_configs"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    
    # Config identity
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # System prompt (the "Setup" section)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Style options
    style_preset: Mapped[str] = mapped_column(String(32), nullable=False, default=StylePreset.generic.value)
    color_mode: Mapped[str] = mapped_column(String(32), nullable=False, default=ColorMode.bw.value)
    
    # Generation parameters
    default_image_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    allow_multi_page: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Extension point
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )


class SceneMangaPage(Base):
    """Links a generation panel to a scene as a manga page.
    
    This is a join/association table that provides scene-specific context
    to generation_board_panels entries.
    """
    
    __tablename__ = "scene_manga_pages"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    
    # Scene context
    scene_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    tome_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    chapter_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    
    # Generation context
    job_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    board_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    panel_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False, unique=True)
    
    # Page ordering within scene (t1-c1-s1-1, t1-c1-s1-2, etc.)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    
    # Optional label for the page
    label: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    
    # Status for page workflow
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")  # draft, selected, rejected
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )
