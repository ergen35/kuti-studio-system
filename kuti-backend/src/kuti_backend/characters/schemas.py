from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class CharacterStatus(StrEnum):
    active = "active"
    draft = "draft"
    archived = "archived"


class CharacterBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    alias: str | None = Field(default=None, max_length=255)
    narrative_role: str | None = Field(default=None, max_length=255)
    description: str = ""
    physical_description: str = ""
    color_palette_json: list[str] = Field(default_factory=list)
    costume_elements_json: list[str] = Field(default_factory=list)
    key_traits_json: list[str] = Field(default_factory=list)
    personality: str = ""
    narrative_arc: str = ""
    tags_json: list[str] = Field(default_factory=list)
    status: CharacterStatus = CharacterStatus.active


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    alias: str | None = Field(default=None, max_length=255)
    narrative_role: str | None = Field(default=None, max_length=255)
    description: str | None = None
    physical_description: str | None = None
    color_palette_json: list[str] | None = None
    costume_elements_json: list[str] | None = None
    key_traits_json: list[str] | None = None
    personality: str | None = None
    narrative_arc: str | None = None
    tags_json: list[str] | None = None
    status: CharacterStatus | None = None


class CharacterDuplicate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)


class CharacterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    slug: str
    name: str
    alias: str | None
    narrative_role: str | None
    description: str
    physical_description: str
    color_palette_json: list[str]
    costume_elements_json: list[str]
    key_traits_json: list[str]
    personality: str
    narrative_arc: str
    tags_json: list[str]
    status: CharacterStatus
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None


class CharacterRelationBase(BaseModel):
    source_character_id: str
    target_character_id: str
    relation_type: str = Field(min_length=1, max_length=64)
    strength: int = Field(default=50, ge=0, le=100)
    narrative_dependency: str = ""
    notes: str = ""


class CharacterRelationCreate(CharacterRelationBase):
    pass


class CharacterRelationUpdate(BaseModel):
    relation_type: str | None = Field(default=None, min_length=1, max_length=64)
    strength: int | None = Field(default=None, ge=0, le=100)
    narrative_dependency: str | None = None
    notes: str | None = None


class CharacterRelationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    source_character_id: str
    target_character_id: str
    relation_type: str
    strength: int
    narrative_dependency: str
    notes: str
    created_at: datetime
    updated_at: datetime


class VoiceSampleCreate(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    asset_path: str | None = None
    voice_notes: str = ""


class VoiceSampleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    character_id: str
    asset_path: str | None
    label: str
    voice_notes: str
    created_at: datetime


class CharacterDetail(CharacterRead):
    relationships_summary: str | None = None
    relations: list[CharacterRelationRead] = Field(default_factory=list)
    voice_samples: list[VoiceSampleRead] = Field(default_factory=list)


class CharacterListResponse(BaseModel):
    items: list[CharacterRead]
