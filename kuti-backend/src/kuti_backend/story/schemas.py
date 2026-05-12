from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class StoryStatus(StrEnum):
    active = "active"
    draft = "draft"
    archived = "archived"


class TomeBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    synopsis: str = ""
    status: StoryStatus = StoryStatus.active
    order_index: int = Field(default=0)


class TomeCreate(TomeBase):
    pass


class TomeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    synopsis: str | None = None
    status: StoryStatus | None = None
    order_index: int | None = None


class TomeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    slug: str
    synopsis: str
    status: StoryStatus
    order_index: int
    created_at: datetime
    updated_at: datetime


class ChapterBase(BaseModel):
    tome_id: str
    title: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    synopsis: str = ""
    status: StoryStatus = StoryStatus.active
    order_index: int = Field(default=0)


class ChapterCreate(ChapterBase):
    pass


class ChapterUpdate(BaseModel):
    tome_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    synopsis: str | None = None
    status: StoryStatus | None = None
    order_index: int | None = None


class ChapterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    tome_id: str
    title: str
    slug: str
    synopsis: str
    status: StoryStatus
    order_index: int
    created_at: datetime
    updated_at: datetime


class SceneBase(BaseModel):
    tome_id: str
    chapter_id: str
    title: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    scene_type: str = Field(default="", max_length=64)
    location: str = Field(default="", max_length=255)
    summary: str = ""
    content: str = ""
    notes: str = ""
    characters_json: list[str] = Field(default_factory=list)
    tags_json: list[str] = Field(default_factory=list)
    status: StoryStatus = StoryStatus.active
    order_index: int = Field(default=0)


class SceneCreate(SceneBase):
    pass


class SceneUpdate(BaseModel):
    tome_id: str | None = None
    chapter_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    scene_type: str | None = Field(default=None, max_length=64)
    location: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    content: str | None = None
    notes: str | None = None
    characters_json: list[str] | None = None
    tags_json: list[str] | None = None
    status: StoryStatus | None = None
    order_index: int | None = None


class SceneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    tome_id: str
    chapter_id: str
    title: str
    slug: str
    scene_type: str
    location: str
    summary: str
    content: str
    notes: str
    characters_json: list[str]
    tags_json: list[str]
    status: StoryStatus
    order_index: int
    created_at: datetime
    updated_at: datetime


class StoryReferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    scene_id: str
    reference_kind: str
    target_slug: str
    raw_token: str
    created_at: datetime


class StorySuggestionRead(BaseModel):
    kind: str
    slug: str
    title: str
    label: str


class StoryOrphanReferenceRead(BaseModel):
    reference: StoryReferenceRead
    reason: str


class StorySummaryResponse(BaseModel):
    tomes: list[TomeRead]
    chapters: list[ChapterRead]
    scenes: list[SceneRead]
    orphan_references: list[StoryOrphanReferenceRead] = Field(default_factory=list)
