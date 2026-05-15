"""Schemas (Pydantic models) for scene generation API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from kuti_backend.scene_generation.models import StylePreset, ColorMode


# =============================================================================
# SceneGenerationConfig Schemas
# =============================================================================

class SceneGenerationConfigCreate(BaseModel):
    """Create a new generation config."""
    name: str = Field(..., min_length=1, max_length=255)
    is_default: bool = False
    system_prompt: str = Field(..., min_length=10)
    style_preset: StylePreset = StylePreset.generic
    color_mode: ColorMode = ColorMode.bw
    default_image_count: int = Field(default=1, ge=1, le=10)
    allow_multi_page: bool = True
    metadata_json: dict = Field(default_factory=dict)


class SceneGenerationConfigUpdate(BaseModel):
    """Update an existing config."""
    name: str | None = Field(default=None, min_length=1, max_length=255)
    is_default: bool | None = None
    system_prompt: str | None = Field(default=None, min_length=10)
    style_preset: StylePreset | None = None
    color_mode: ColorMode | None = None
    default_image_count: int | None = Field(default=None, ge=1, le=10)
    allow_multi_page: bool | None = None
    metadata_json: dict | None = None


class SceneGenerationConfigRead(BaseModel):
    """Config read model."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    project_id: str
    name: str
    is_default: bool
    system_prompt: str
    style_preset: str
    color_mode: str
    default_image_count: int
    allow_multi_page: bool
    metadata_json: dict[str, object]
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Scene Generation Request Schemas
# =============================================================================

class SceneGenerateRequest(BaseModel):
    """Request to generate manga pages from a scene."""
    config_id: str | None = None  # Use default if not provided
    image_count: int = Field(default=1, ge=1, le=5)  # Number of pages to generate
    
    # Override specific settings for this generation
    style_override: dict | None = Field(default=None, description="Optional style overrides")
    
    # Force specific character images
    character_image_refs: dict[str, str] = Field(
        default_factory=dict,
        description="Map of character slug to image ID to use as reference"
    )
    
    # Additional prompt context
    additional_context: str = Field(
        default="",
        description="Additional context to append to the scene description"
    )


class SceneGenerateResponse(BaseModel):
    """Response after triggering generation."""
    job_id: str
    status: str
    message: str = "Generation job started"


# =============================================================================
# Scene Manga Page Schemas
# =============================================================================

class SceneMangaPageRead(BaseModel):
    """Read model for a scene manga page."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    project_id: str
    scene_id: str
    tome_id: str
    chapter_id: str
    job_id: str
    board_id: str
    panel_id: str
    page_number: int
    label: str
    status: str
    
    # Panel details (joined from GenerationBoardPanel)
    image_url: str | None = None
    caption: str | None = None
    prompt: str | None = None
    
    created_at: datetime
    updated_at: datetime


class SceneMangaPageUpdate(BaseModel):
    """Update page metadata."""
    label: str | None = Field(default=None, max_length=255)
    status: Literal["draft", "selected", "rejected"] | None = None


# =============================================================================
# Preview/Validation Schemas
# =============================================================================

class PromptPreviewRequest(BaseModel):
    """Request to preview the generated prompt without running generation."""
    config_id: str | None = None
    character_image_refs: dict[str, str] = Field(default_factory=dict)
    additional_context: str = ""


class PromptPreviewResponse(BaseModel):
    """Preview of the prompt that would be sent."""
    system_prompt: str
    scene_section: str
    full_prompt: str
    character_summaries: list[dict[str, str]]
    warnings: list[str] = Field(default_factory=list)


# =============================================================================
# List/Filter Schemas
# =============================================================================

class SceneGenerationListResponse(BaseModel):
    """List of generation jobs for a scene."""
    scene_id: str
    pages: list[SceneMangaPageRead]
    total_pages: int
