from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from kuti_backend.core.database import get_session
from kuti_backend.api.errors import (
    CHAPTER_NOT_FOUND,
    CHAPTER_MISSING_TOME,
    PROJECT_NOT_FOUND,
    SCENE_NOT_FOUND,
    SCENE_HIERARCHY_MISMATCH,
    TOME_NOT_FOUND,
    raise_api_error,
)
from kuti_backend.projects.repository import get_project as get_project_record
from kuti_backend.story.repository import (
    create_chapter,
    create_scene,
    create_tome,
    delete_chapter,
    delete_scene,
    delete_tome,
    get_chapter,
    get_scene,
    get_tome,
    list_chapters,
    list_references,
    list_scenes,
    list_suggestions,
    list_tomes,
    summarize_story,
    update_chapter,
    update_scene,
    update_tome,
)
from kuti_backend.warnings.repository import rebuild_warnings
from kuti_backend.story.schemas import (
    ChapterCreate,
    ChapterRead,
    ChapterUpdate,
    SceneCreate,
    SceneRead,
    SceneUpdate,
    StoryReferenceRead,
    StorySummaryResponse,
    StorySuggestionRead,
    TomeCreate,
    TomeRead,
    TomeUpdate,
)

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


def _project_or_404(session: Session, project_id: str):
    project = get_project_record(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return project


def _tome_or_404(session: Session, project_id: str, tome_id: str):
    tome = get_tome(session, project_id, tome_id)
    if tome is None:
        raise_api_error(404, TOME_NOT_FOUND)
    return tome


def _chapter_or_404(session: Session, project_id: str, chapter_id: str):
    chapter = get_chapter(session, project_id, chapter_id)
    if chapter is None:
        raise_api_error(404, CHAPTER_NOT_FOUND)
    return chapter


def _scene_or_404(session: Session, project_id: str, scene_id: str):
    scene = get_scene(session, project_id, scene_id)
    if scene is None:
        raise_api_error(404, SCENE_NOT_FOUND)
    return scene


@router.get("/projects/{project_id}/story", response_model=StorySummaryResponse)
def read_story(session: SessionDep, project_id: str) -> StorySummaryResponse:
    _project_or_404(session, project_id)
    summary = summarize_story(session, project_id)
    return StorySummaryResponse(**summary)


@router.get("/projects/{project_id}/story/suggestions", response_model=list[StorySuggestionRead])
def read_story_suggestions(session: SessionDep, project_id: str, query: str | None = Query(default=None)) -> list[StorySuggestionRead]:
    _project_or_404(session, project_id)
    return list_suggestions(session, project_id, query=query)


@router.get("/projects/{project_id}/story/references", response_model=list[StoryReferenceRead])
def read_story_references(session: SessionDep, project_id: str, scene_id: str | None = Query(default=None)) -> list[StoryReferenceRead]:
    _project_or_404(session, project_id)
    return [StoryReferenceRead.model_validate(reference) for reference in list_references(session, project_id, scene_id)]


@router.get("/projects/{project_id}/story/tomes", response_model=list[TomeRead])
def read_tomes(session: SessionDep, project_id: str) -> list[TomeRead]:
    _project_or_404(session, project_id)
    return [TomeRead.model_validate(tome) for tome in list_tomes(session, project_id)]


@router.post("/projects/{project_id}/story/tomes", response_model=TomeRead, status_code=status.HTTP_201_CREATED)
def create_tome_route(session: SessionDep, project_id: str, payload: TomeCreate) -> TomeRead:
    try:
        tome = create_tome(session, project_id, payload)
        rebuild_warnings(session, project_id)
        return tome
    except ValueError as exc:
        message = str(exc)
        if message == "project_not_found":
            raise_api_error(404, PROJECT_NOT_FOUND)
        raise HTTPException(status_code=409, detail=message) from exc


@router.patch("/projects/{project_id}/story/tomes/{tome_id}", response_model=TomeRead)
def update_tome_route(session: SessionDep, project_id: str, tome_id: str, payload: TomeUpdate) -> TomeRead:
    _project_or_404(session, project_id)
    tome = _tome_or_404(session, project_id, tome_id)
    updated = update_tome(session, project_id, tome, payload)
    rebuild_warnings(session, project_id)
    return updated


@router.delete("/projects/{project_id}/story/tomes/{tome_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tome_route(session: SessionDep, project_id: str, tome_id: str) -> None:
    _project_or_404(session, project_id)
    tome = _tome_or_404(session, project_id, tome_id)
    delete_tome(session, tome)
    rebuild_warnings(session, project_id)


@router.get("/projects/{project_id}/story/chapters", response_model=list[ChapterRead])
def read_chapters(session: SessionDep, project_id: str, tome_id: str | None = Query(default=None)) -> list[ChapterRead]:
    _project_or_404(session, project_id)
    if tome_id is not None:
        _tome_or_404(session, project_id, tome_id)
    return [ChapterRead.model_validate(chapter) for chapter in list_chapters(session, project_id, tome_id)]


@router.post("/projects/{project_id}/story/chapters", response_model=ChapterRead, status_code=status.HTTP_201_CREATED)
def create_chapter_route(session: SessionDep, project_id: str, payload: ChapterCreate) -> ChapterRead:
    try:
        chapter = create_chapter(session, project_id, payload)
        rebuild_warnings(session, project_id)
        return chapter
    except ValueError as exc:
        message = str(exc)
        if message == "project_not_found":
            raise_api_error(404, PROJECT_NOT_FOUND)
        if message == "chapter_missing_tome":
            raise_api_error(404, CHAPTER_MISSING_TOME)
        raise HTTPException(status_code=409, detail=message) from exc


@router.patch("/projects/{project_id}/story/chapters/{chapter_id}", response_model=ChapterRead)
def update_chapter_route(session: SessionDep, project_id: str, chapter_id: str, payload: ChapterUpdate) -> ChapterRead:
    _project_or_404(session, project_id)
    chapter = _chapter_or_404(session, project_id, chapter_id)
    try:
        updated = update_chapter(session, project_id, chapter, payload)
        rebuild_warnings(session, project_id)
        return updated
    except ValueError as exc:
        message = str(exc)
        if message == "chapter_missing_tome":
            raise_api_error(404, CHAPTER_MISSING_TOME)
        raise HTTPException(status_code=409, detail=message) from exc


@router.delete("/projects/{project_id}/story/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chapter_route(session: SessionDep, project_id: str, chapter_id: str) -> None:
    _project_or_404(session, project_id)
    chapter = _chapter_or_404(session, project_id, chapter_id)
    delete_chapter(session, chapter)
    rebuild_warnings(session, project_id)


@router.get("/projects/{project_id}/story/scenes", response_model=list[SceneRead])
def read_scenes(session: SessionDep, project_id: str, chapter_id: str | None = Query(default=None)) -> list[SceneRead]:
    _project_or_404(session, project_id)
    if chapter_id is not None:
        _chapter_or_404(session, project_id, chapter_id)
    return [SceneRead.model_validate(scene) for scene in list_scenes(session, project_id, chapter_id)]


@router.post("/projects/{project_id}/story/scenes", response_model=SceneRead, status_code=status.HTTP_201_CREATED)
def create_scene_route(session: SessionDep, project_id: str, payload: SceneCreate) -> SceneRead:
    try:
        scene = create_scene(session, project_id, payload)
        rebuild_warnings(session, project_id)
        return scene
    except ValueError as exc:
        message = str(exc)
        if message == "project_not_found":
            raise_api_error(404, PROJECT_NOT_FOUND)
        if message == "scene_hierarchy_mismatch":
            raise_api_error(404, SCENE_HIERARCHY_MISMATCH)
        raise HTTPException(status_code=409, detail=message) from exc


@router.patch("/projects/{project_id}/story/scenes/{scene_id}", response_model=SceneRead)
def update_scene_route(session: SessionDep, project_id: str, scene_id: str, payload: SceneUpdate) -> SceneRead:
    _project_or_404(session, project_id)
    scene = _scene_or_404(session, project_id, scene_id)
    try:
        updated = update_scene(session, project_id, scene, payload)
        rebuild_warnings(session, project_id)
        return updated
    except ValueError as exc:
        message = str(exc)
        if message == "scene_hierarchy_mismatch":
            raise_api_error(404, SCENE_HIERARCHY_MISMATCH)
        raise HTTPException(status_code=409, detail=message) from exc


@router.delete("/projects/{project_id}/story/scenes/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scene_route(session: SessionDep, project_id: str, scene_id: str) -> None:
    _project_or_404(session, project_id)
    scene = _scene_or_404(session, project_id, scene_id)
    delete_scene(session, scene)
    rebuild_warnings(session, project_id)
