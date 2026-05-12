from __future__ import annotations

import re
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from kuti_backend.characters.models import Character
from kuti_backend.characters.repository import list_characters
from kuti_backend.projects.models import Project
from kuti_backend.story.models import Chapter, Scene, StoryReference, Tome
from kuti_backend.story.schemas import (
    ChapterCreate,
    ChapterUpdate,
    SceneCreate,
    SceneUpdate,
    StoryOrphanReferenceRead,
    StoryReferenceRead,
    StorySuggestionRead,
    TomeCreate,
    TomeUpdate,
)

REFERENCE_PATTERN = re.compile(r"@(?P<kind>tome|chapter|scene|character):(?P<slug>[a-z0-9][a-z0-9-]*)", re.IGNORECASE)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return slug or "item"


def _normalize_list(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        item = value.strip()
        if item and item not in seen:
            seen.add(item)
            result.append(item)
    return result


def _project_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError("project_not_found")
    return project


def _unique_slug(session: Session, model, base_slug: str, project_id: str, ignore_id: str | None = None) -> str:
    candidate = base_slug
    index = 2
    while True:
        stmt = select(model.id).where(model.project_id == project_id, model.slug == candidate)
        if ignore_id is not None:
            stmt = stmt.where(model.id != ignore_id)
        if session.scalar(stmt) is None:
            return candidate
        candidate = f"{base_slug}-{index}"
        index += 1


def list_tomes(session: Session, project_id: str) -> list[Tome]:
    stmt = select(Tome).where(Tome.project_id == project_id).order_by(Tome.order_index.asc(), Tome.title.asc())
    return list(session.scalars(stmt))


def get_tome(session: Session, project_id: str, tome_id: str) -> Tome | None:
    stmt = select(Tome).where(Tome.project_id == project_id, Tome.id == tome_id)
    return session.scalar(stmt)


def get_tome_by_slug(session: Session, project_id: str, slug: str) -> Tome | None:
    stmt = select(Tome).where(Tome.project_id == project_id, Tome.slug == slug)
    return session.scalar(stmt)


def create_tome(session: Session, project_id: str, payload: TomeCreate) -> Tome:
    _project_or_404(session, project_id)
    base_slug = slugify(payload.slug or payload.title)
    slug = _unique_slug(session, Tome, base_slug, project_id)
    tome = Tome(
        id=str(uuid4()),
        project_id=project_id,
        title=payload.title,
        slug=slug,
        synopsis=payload.synopsis,
        status=payload.status,
        order_index=payload.order_index,
    )
    session.add(tome)
    session.commit()
    session.refresh(tome)
    return tome


def update_tome(session: Session, project_id: str, tome: Tome, payload: TomeUpdate) -> Tome:
    if payload.title is not None:
        tome.title = payload.title
    if payload.slug is not None:
        tome.slug = _unique_slug(session, Tome, slugify(payload.slug), project_id, ignore_id=tome.id)
    if payload.synopsis is not None:
        tome.synopsis = payload.synopsis
    if payload.status is not None:
        tome.status = payload.status
    if payload.order_index is not None:
        tome.order_index = payload.order_index
    tome.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(tome)
    return tome


def delete_tome(session: Session, tome: Tome) -> None:
    chapter_ids = [chapter_id for (chapter_id,) in session.execute(select(Chapter.id).where(Chapter.tome_id == tome.id)).all()]
    scene_ids = [scene_id for (scene_id,) in session.execute(select(Scene.id).where(Scene.tome_id == tome.id)).all()]
    if scene_ids:
        session.execute(delete(StoryReference).where(StoryReference.scene_id.in_(scene_ids)))
        session.execute(delete(Scene).where(Scene.id.in_(scene_ids)))
    if chapter_ids:
        session.execute(delete(Chapter).where(Chapter.id.in_(chapter_ids)))
    session.delete(tome)
    session.commit()


def list_chapters(session: Session, project_id: str, tome_id: str | None = None) -> list[Chapter]:
    stmt = select(Chapter).where(Chapter.project_id == project_id)
    if tome_id is not None:
        stmt = stmt.where(Chapter.tome_id == tome_id)
    stmt = stmt.order_by(Chapter.order_index.asc(), Chapter.title.asc())
    return list(session.scalars(stmt))


def get_chapter(session: Session, project_id: str, chapter_id: str) -> Chapter | None:
    stmt = select(Chapter).where(Chapter.project_id == project_id, Chapter.id == chapter_id)
    return session.scalar(stmt)


def get_chapter_by_slug(session: Session, project_id: str, tome_id: str, slug: str) -> Chapter | None:
    stmt = select(Chapter).where(Chapter.project_id == project_id, Chapter.slug == slug)
    return session.scalar(stmt)


def create_chapter(session: Session, project_id: str, payload: ChapterCreate) -> Chapter:
    _project_or_404(session, project_id)
    tome = get_tome(session, project_id, payload.tome_id)
    if tome is None:
        raise ValueError("chapter_missing_tome")
    base_slug = slugify(payload.slug or payload.title)
    slug = _unique_slug(session, Chapter, base_slug, project_id)
    chapter = Chapter(
        id=str(uuid4()),
        project_id=project_id,
        tome_id=payload.tome_id,
        title=payload.title,
        slug=slug,
        synopsis=payload.synopsis,
        status=payload.status,
        order_index=payload.order_index,
    )
    session.add(chapter)
    session.commit()
    session.refresh(chapter)
    return chapter


def update_chapter(session: Session, project_id: str, chapter: Chapter, payload: ChapterUpdate) -> Chapter:
    if payload.tome_id is not None and payload.tome_id != chapter.tome_id:
        if get_tome(session, project_id, payload.tome_id) is None:
            raise ValueError("chapter_missing_tome")
        chapter.tome_id = payload.tome_id
    if payload.title is not None:
        chapter.title = payload.title
    if payload.slug is not None:
        chapter.slug = _unique_slug(session, Chapter, slugify(payload.slug), project_id, ignore_id=chapter.id)
    if payload.synopsis is not None:
        chapter.synopsis = payload.synopsis
    if payload.status is not None:
        chapter.status = payload.status
    if payload.order_index is not None:
        chapter.order_index = payload.order_index
    chapter.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(chapter)
    return chapter


def delete_chapter(session: Session, chapter: Chapter) -> None:
    scene_ids = [scene_id for (scene_id,) in session.execute(select(Scene.id).where(Scene.chapter_id == chapter.id)).all()]
    if scene_ids:
        session.execute(delete(StoryReference).where(StoryReference.scene_id.in_(scene_ids)))
        session.execute(delete(Scene).where(Scene.id.in_(scene_ids)))
    session.delete(chapter)
    session.commit()


def list_scenes(session: Session, project_id: str, chapter_id: str | None = None) -> list[Scene]:
    stmt = select(Scene).where(Scene.project_id == project_id)
    if chapter_id is not None:
        stmt = stmt.where(Scene.chapter_id == chapter_id)
    stmt = stmt.order_by(Scene.order_index.asc(), Scene.title.asc())
    return list(session.scalars(stmt))


def get_scene(session: Session, project_id: str, scene_id: str) -> Scene | None:
    stmt = select(Scene).where(Scene.project_id == project_id, Scene.id == scene_id)
    return session.scalar(stmt)


def get_scene_by_slug(session: Session, project_id: str, chapter_id: str, slug: str) -> Scene | None:
    stmt = select(Scene).where(Scene.project_id == project_id, Scene.slug == slug)
    return session.scalar(stmt)


def _resolve_reference_target(session: Session, project_id: str, kind: str, slug: str):
    kind = kind.lower()
    if kind == "tome":
        return session.scalar(select(Tome).where(Tome.project_id == project_id, Tome.slug == slug))
    if kind == "chapter":
        return session.scalar(select(Chapter).where(Chapter.project_id == project_id, Chapter.slug == slug))
    if kind == "scene":
        return session.scalar(select(Scene).where(Scene.project_id == project_id, Scene.slug == slug))
    if kind == "character":
        return session.scalar(select(Character).where(Character.project_id == project_id, Character.slug == slug))
    return None


def _sync_references(session: Session, project_id: str, scene: Scene) -> list[StoryReference]:
    session.execute(delete(StoryReference).where(StoryReference.scene_id == scene.id))
    references: list[StoryReference] = []
    tokens = list(REFERENCE_PATTERN.finditer(scene.content or ""))
    for match in tokens:
        kind = match.group("kind").lower()
        slug = match.group("slug").lower()
        reference = StoryReference(
            id=str(uuid4()),
            project_id=project_id,
            scene_id=scene.id,
            reference_kind=kind,
            target_slug=slug,
            raw_token=match.group(0),
        )
        session.add(reference)
        references.append(reference)
    return references


def _validate_scene_hierarchy(session: Session, project_id: str, tome_id: str, chapter_id: str) -> None:
    tome = get_tome(session, project_id, tome_id)
    chapter = get_chapter(session, project_id, chapter_id)
    if tome is None or chapter is None or chapter.tome_id != tome.id:
        raise ValueError("scene_hierarchy_mismatch")


def create_scene(session: Session, project_id: str, payload: SceneCreate) -> Scene:
    _project_or_404(session, project_id)
    _validate_scene_hierarchy(session, project_id, payload.tome_id, payload.chapter_id)
    base_slug = slugify(payload.slug or payload.title)
    slug = _unique_slug(session, Scene, base_slug, project_id)
    scene = Scene(
        id=str(uuid4()),
        project_id=project_id,
        tome_id=payload.tome_id,
        chapter_id=payload.chapter_id,
        title=payload.title,
        slug=slug,
        scene_type=payload.scene_type,
        location=payload.location,
        summary=payload.summary,
        content=payload.content,
        notes=payload.notes,
        characters_json=_normalize_list(payload.characters_json),
        tags_json=_normalize_list(payload.tags_json),
        status=payload.status,
        order_index=payload.order_index,
    )
    session.add(scene)
    session.flush()
    _sync_references(session, project_id, scene)
    session.commit()
    session.refresh(scene)
    return scene


def update_scene(session: Session, project_id: str, scene: Scene, payload: SceneUpdate) -> Scene:
    if payload.tome_id is not None or payload.chapter_id is not None:
        tome_id = payload.tome_id or scene.tome_id
        chapter_id = payload.chapter_id or scene.chapter_id
        _validate_scene_hierarchy(session, project_id, tome_id, chapter_id)
        scene.tome_id = tome_id
        scene.chapter_id = chapter_id
    if payload.title is not None:
        scene.title = payload.title
    if payload.slug is not None:
        scene.slug = _unique_slug(session, Scene, slugify(payload.slug), project_id, ignore_id=scene.id)
    if payload.scene_type is not None:
        scene.scene_type = payload.scene_type
    if payload.location is not None:
        scene.location = payload.location
    if payload.summary is not None:
        scene.summary = payload.summary
    if payload.content is not None:
        scene.content = payload.content
    if payload.notes is not None:
        scene.notes = payload.notes
    if payload.characters_json is not None:
        scene.characters_json = _normalize_list(payload.characters_json)
    if payload.tags_json is not None:
        scene.tags_json = _normalize_list(payload.tags_json)
    if payload.status is not None:
        scene.status = payload.status
    if payload.order_index is not None:
        scene.order_index = payload.order_index
    scene.updated_at = datetime.now(UTC)
    session.flush()
    _sync_references(session, project_id, scene)
    session.commit()
    session.refresh(scene)
    return scene


def delete_scene(session: Session, scene: Scene) -> None:
    session.execute(delete(StoryReference).where(StoryReference.scene_id == scene.id))
    session.delete(scene)
    session.commit()


def list_references(session: Session, project_id: str, scene_id: str | None = None) -> list[StoryReference]:
    stmt = select(StoryReference).where(StoryReference.project_id == project_id)
    if scene_id is not None:
        stmt = stmt.where(StoryReference.scene_id == scene_id)
    stmt = stmt.order_by(StoryReference.created_at.asc())
    return list(session.scalars(stmt))


def list_orphans(session: Session, project_id: str) -> list[StoryOrphanReferenceRead]:
    orphans: list[StoryOrphanReferenceRead] = []
    for reference in list_references(session, project_id):
        target = _resolve_reference_target(session, project_id, reference.reference_kind, reference.target_slug)
        if target is None:
            orphans.append(
                StoryOrphanReferenceRead(
                    reference=StoryReferenceRead.model_validate(reference),
                    reason="target_not_found",
                )
            )
    return orphans


def list_suggestions(session: Session, project_id: str, query: str | None = None) -> list[StorySuggestionRead]:
    needle = (query or "").strip().lower()
    suggestions: list[StorySuggestionRead] = []

    def matches(text: str) -> bool:
        return not needle or needle in text.lower()

    for tome in list_tomes(session, project_id):
        if matches(tome.title) or matches(tome.slug):
            suggestions.append(StorySuggestionRead(kind="tome", slug=tome.slug, title=tome.title, label=f"Tome · {tome.title}"))

    for chapter in list_chapters(session, project_id):
        if matches(chapter.title) or matches(chapter.slug):
            suggestions.append(StorySuggestionRead(kind="chapter", slug=chapter.slug, title=chapter.title, label=f"Chapter · {chapter.title}"))

    for scene in list_scenes(session, project_id):
        if matches(scene.title) or matches(scene.slug):
            suggestions.append(StorySuggestionRead(kind="scene", slug=scene.slug, title=scene.title, label=f"Scene · {scene.title}"))

    for character in list_characters(session, project_id):
        character_slug = character.slug
        if matches(character.name) or matches(character_slug):
            suggestions.append(StorySuggestionRead(kind="character", slug=character_slug, title=character.name, label=f"Character · {character.name}"))

    return suggestions


def summarize_story(session: Session, project_id: str):
    return {
        "tomes": list_tomes(session, project_id),
        "chapters": list_chapters(session, project_id),
        "scenes": list_scenes(session, project_id),
        "orphan_references": list_orphans(session, project_id),
    }
