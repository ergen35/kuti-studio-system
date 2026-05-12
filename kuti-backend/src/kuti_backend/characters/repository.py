from __future__ import annotations

from datetime import UTC, datetime
import re
from uuid import uuid4

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from kuti_backend.characters.models import Character, CharacterRelation, VoiceSample
from kuti_backend.characters.schemas import (
    CharacterCreate,
    CharacterDuplicate,
    CharacterRelationCreate,
    CharacterRelationUpdate,
    CharacterUpdate,
    VoiceSampleCreate,
)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return slug or "item"


def _normalize_tags(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for tag in tags:
        value = tag.strip()
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def list_characters(session: Session, project_id: str) -> list[Character]:
    stmt = select(Character).where(Character.project_id == project_id).order_by(Character.updated_at.desc(), Character.name.asc())
    return list(session.scalars(stmt))


def get_character(session: Session, project_id: str, character_id: str) -> Character | None:
    stmt = select(Character).where(Character.project_id == project_id, Character.id == character_id)
    return session.scalar(stmt)


def _character_exists(session: Session, project_id: str, character_id: str) -> bool:
    stmt = select(Character.id).where(Character.project_id == project_id, Character.id == character_id)
    return session.scalar(stmt) is not None


def _ensure_unique_character_name(session: Session, project_id: str, name: str, ignore_id: str | None = None) -> None:
    stmt = select(Character.id).where(Character.project_id == project_id, Character.name == name)
    if ignore_id is not None:
        stmt = stmt.where(Character.id != ignore_id)
    if session.scalar(stmt) is not None:
        raise ValueError("character_name_conflict")


def _unique_slug(session: Session, project_id: str, base_slug: str, ignore_id: str | None = None) -> str:
    candidate = base_slug
    index = 2
    while True:
        stmt = select(Character.id).where(Character.project_id == project_id, Character.slug == candidate)
        if ignore_id is not None:
            stmt = stmt.where(Character.id != ignore_id)
        if session.scalar(stmt) is None:
            return candidate
        candidate = f"{base_slug}-{index}"
        index += 1


def create_character(session: Session, project_id: str, payload: CharacterCreate) -> Character:
    _ensure_unique_character_name(session, project_id, payload.name)
    slug = _unique_slug(session, project_id, slugify(payload.name))
    character = Character(
        id=str(uuid4()),
        project_id=project_id,
        slug=slug,
        name=payload.name,
        alias=payload.alias,
        narrative_role=payload.narrative_role,
        description=payload.description,
        physical_description=payload.physical_description,
        color_palette_json=_normalize_tags(payload.color_palette_json),
        costume_elements_json=_normalize_tags(payload.costume_elements_json),
        key_traits_json=_normalize_tags(payload.key_traits_json),
        personality=payload.personality,
        narrative_arc=payload.narrative_arc,
        tags_json=_normalize_tags(payload.tags_json),
        status=payload.status,
    )
    session.add(character)
    session.commit()
    session.refresh(character)
    return character


def update_character(session: Session, project_id: str, character: Character, payload: CharacterUpdate) -> Character:
    if payload.name is not None and payload.name != character.name:
        _ensure_unique_character_name(session, project_id, payload.name, ignore_id=character.id)
        character.name = payload.name
    if payload.alias is not None:
        character.alias = payload.alias
    if payload.narrative_role is not None:
        character.narrative_role = payload.narrative_role
    if payload.description is not None:
        character.description = payload.description
    if payload.physical_description is not None:
        character.physical_description = payload.physical_description
    if payload.color_palette_json is not None:
        character.color_palette_json = _normalize_tags(payload.color_palette_json)
    if payload.costume_elements_json is not None:
        character.costume_elements_json = _normalize_tags(payload.costume_elements_json)
    if payload.key_traits_json is not None:
        character.key_traits_json = _normalize_tags(payload.key_traits_json)
    if payload.personality is not None:
        character.personality = payload.personality
    if payload.narrative_arc is not None:
        character.narrative_arc = payload.narrative_arc
    if payload.tags_json is not None:
        character.tags_json = _normalize_tags(payload.tags_json)
    if payload.status is not None:
        character.status = payload.status
    character.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(character)
    return character


def archive_character(session: Session, character: Character) -> Character:
    character.status = "archived"
    character.archived_at = datetime.now(UTC)
    character.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(character)
    return character


def duplicate_character(session: Session, project_id: str, character: Character, payload: CharacterDuplicate) -> Character:
    copy_name = payload.name or f"{character.name} Copy"
    _ensure_unique_character_name(session, project_id, copy_name)
    slug = _unique_slug(session, project_id, slugify(copy_name))
    duplicate = Character(
        id=str(uuid4()),
        project_id=project_id,
        slug=slug,
        name=copy_name,
        alias=character.alias,
        narrative_role=character.narrative_role,
        description=character.description,
        physical_description=character.physical_description,
        color_palette_json=list(character.color_palette_json),
        costume_elements_json=list(character.costume_elements_json),
        key_traits_json=list(character.key_traits_json),
        personality=character.personality,
        narrative_arc=character.narrative_arc,
        tags_json=list(character.tags_json),
        status="active",
    )
    session.add(duplicate)
    session.commit()
    session.refresh(duplicate)
    return duplicate


def delete_character(session: Session, character: Character) -> None:
    session.execute(
        delete(CharacterRelation).where(
            CharacterRelation.project_id == character.project_id,
            or_(
                CharacterRelation.source_character_id == character.id,
                CharacterRelation.target_character_id == character.id,
            ),
        )
    )
    session.execute(
        delete(VoiceSample).where(
            VoiceSample.project_id == character.project_id,
            VoiceSample.character_id == character.id,
        )
    )
    session.delete(character)
    session.commit()


def list_relations(session: Session, project_id: str, character_id: str) -> list[CharacterRelation]:
    stmt = select(CharacterRelation).where(
        CharacterRelation.project_id == project_id,
        or_(
            CharacterRelation.source_character_id == character_id,
            CharacterRelation.target_character_id == character_id,
        ),
    ).order_by(CharacterRelation.updated_at.desc())
    return list(session.scalars(stmt))


def _relation_exists(session: Session, project_id: str, payload: CharacterRelationCreate) -> bool:
    stmt = select(CharacterRelation.id).where(
        CharacterRelation.project_id == project_id,
        CharacterRelation.source_character_id == payload.source_character_id,
        CharacterRelation.target_character_id == payload.target_character_id,
        CharacterRelation.relation_type == payload.relation_type,
    )
    return session.scalar(stmt) is not None


def create_relation(session: Session, project_id: str, payload: CharacterRelationCreate) -> CharacterRelation:
    if payload.source_character_id == payload.target_character_id:
        raise ValueError("relation_self_reference")
    if not _character_exists(session, project_id, payload.source_character_id) or not _character_exists(session, project_id, payload.target_character_id):
        raise ValueError("relation_missing_character")
    if _relation_exists(session, project_id, payload):
        raise ValueError("relation_conflict")
    relation = CharacterRelation(
        id=str(uuid4()),
        project_id=project_id,
        source_character_id=payload.source_character_id,
        target_character_id=payload.target_character_id,
        relation_type=payload.relation_type,
        strength=payload.strength,
        narrative_dependency=payload.narrative_dependency,
        notes=payload.notes,
    )
    session.add(relation)
    session.commit()
    session.refresh(relation)
    return relation


def update_relation(session: Session, relation: CharacterRelation, payload: CharacterRelationUpdate) -> CharacterRelation:
    if payload.relation_type is not None:
        relation.relation_type = payload.relation_type
    if payload.strength is not None:
        relation.strength = payload.strength
    if payload.narrative_dependency is not None:
        relation.narrative_dependency = payload.narrative_dependency
    if payload.notes is not None:
        relation.notes = payload.notes
    relation.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(relation)
    return relation


def delete_relation(session: Session, relation: CharacterRelation) -> None:
    session.delete(relation)
    session.commit()


def list_voice_samples(session: Session, project_id: str, character_id: str) -> list[VoiceSample]:
    stmt = select(VoiceSample).where(VoiceSample.project_id == project_id, VoiceSample.character_id == character_id).order_by(VoiceSample.created_at.desc())
    return list(session.scalars(stmt))


def create_voice_sample(session: Session, project_id: str, character_id: str, payload: VoiceSampleCreate) -> VoiceSample:
    sample = VoiceSample(
        id=str(uuid4()),
        project_id=project_id,
        character_id=character_id,
        asset_path=payload.asset_path,
        label=payload.label,
        voice_notes=payload.voice_notes,
    )
    session.add(sample)
    session.commit()
    session.refresh(sample)
    return sample
