from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from kuti_backend.core.database import get_session
from kuti_backend.projects.repository import get_project as get_project_record
from kuti_backend.characters.repository import (
    archive_character,
    create_character,
    create_relation,
    create_voice_sample,
    delete_character,
    delete_relation,
    duplicate_character,
    get_character,
    list_characters,
    list_relations,
    list_voice_samples,
    update_character,
    update_relation,
)
from kuti_backend.warnings.repository import rebuild_warnings
from kuti_backend.characters.schemas import (
    CharacterCreate,
    CharacterDetail,
    CharacterDuplicate,
    CharacterListResponse,
    CharacterRead,
    CharacterRelationCreate,
    CharacterRelationRead,
    CharacterRelationUpdate,
    CharacterUpdate,
    VoiceSampleCreate,
    VoiceSampleRead,
)
from kuti_backend.api.errors import (
    CHARACTER_NAME_CONFLICT,
    CHARACTER_NOT_FOUND,
    PROJECT_NOT_FOUND,
    RELATION_CONFLICT,
    RELATION_MISSING_CHARACTER,
    RELATION_NOT_FOUND,
    RELATION_SELF_REFERENCE,
    SOURCE_CHARACTER_ID_MUST_MATCH_ROUTE_CHARACTER,
    raise_api_error,
)

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


def _project_or_404(session: Session, project_id: str):
    project = get_project_record(session, project_id)
    if project is None:
        raise_api_error(404, PROJECT_NOT_FOUND)
    return project


def _character_or_404(session: Session, project_id: str, character_id: str):
    character = get_character(session, project_id, character_id)
    if character is None:
        raise_api_error(404, CHARACTER_NOT_FOUND)
    return character


@router.get("/projects/{project_id}/characters", response_model=CharacterListResponse)
def read_characters(session: SessionDep, project_id: str) -> CharacterListResponse:
    _project_or_404(session, project_id)
    return CharacterListResponse(items=list_characters(session, project_id))


@router.post("/projects/{project_id}/characters", response_model=CharacterRead, status_code=status.HTTP_201_CREATED)
def create_character_route(session: SessionDep, project_id: str, payload: CharacterCreate) -> CharacterRead:
    _project_or_404(session, project_id)
    try:
        character = create_character(session, project_id, payload)
        rebuild_warnings(session, project_id)
        return character
    except ValueError as exc:
        message = str(exc)
        if message == "character_name_conflict":
            raise_api_error(409, CHARACTER_NAME_CONFLICT)
        raise HTTPException(status_code=409, detail=message) from exc


@router.get("/projects/{project_id}/characters/{character_id}", response_model=CharacterDetail)
def read_character(session: SessionDep, project_id: str, character_id: str) -> CharacterDetail:
    _project_or_404(session, project_id)
    character = _character_or_404(session, project_id, character_id)
    relations = list_relations(session, project_id, character_id)
    return CharacterDetail(
        **CharacterRead.model_validate(character).model_dump(),
        relations=[CharacterRelationRead.model_validate(r) for r in relations],
        voice_samples=[VoiceSampleRead.model_validate(v) for v in list_voice_samples(session, project_id, character_id)],
        relationships_summary=" / ".join(f"{relation.relation_type}:{relation.strength}" for relation in relations) or None,
    )


@router.patch("/projects/{project_id}/characters/{character_id}", response_model=CharacterRead)
def update_character_route(session: SessionDep, project_id: str, character_id: str, payload: CharacterUpdate) -> CharacterRead:
    _project_or_404(session, project_id)
    character = _character_or_404(session, project_id, character_id)
    try:
        updated = update_character(session, project_id, character, payload)
        rebuild_warnings(session, project_id)
        return updated
    except ValueError as exc:
        message = str(exc)
        if message == "character_name_conflict":
            raise_api_error(409, CHARACTER_NAME_CONFLICT)
        raise HTTPException(status_code=409, detail=message) from exc


@router.post("/projects/{project_id}/characters/{character_id}/duplicate", response_model=CharacterRead, status_code=status.HTTP_201_CREATED)
def duplicate_character_route(session: SessionDep, project_id: str, character_id: str, payload: CharacterDuplicate) -> CharacterRead:
    _project_or_404(session, project_id)
    character = _character_or_404(session, project_id, character_id)
    try:
        duplicate = duplicate_character(session, project_id, character, payload)
        rebuild_warnings(session, project_id)
        return duplicate
    except ValueError as exc:
        message = str(exc)
        if message == "character_name_conflict":
            raise_api_error(409, CHARACTER_NAME_CONFLICT)
        raise HTTPException(status_code=409, detail=message) from exc


@router.post("/projects/{project_id}/characters/{character_id}/archive", response_model=CharacterRead)
def archive_character_route(session: SessionDep, project_id: str, character_id: str) -> CharacterRead:
    _project_or_404(session, project_id)
    character = _character_or_404(session, project_id, character_id)
    archived = archive_character(session, character)
    rebuild_warnings(session, project_id)
    return archived


@router.delete("/projects/{project_id}/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character_route(session: SessionDep, project_id: str, character_id: str) -> None:
    _project_or_404(session, project_id)
    character = _character_or_404(session, project_id, character_id)
    delete_character(session, character)
    rebuild_warnings(session, project_id)


@router.post("/projects/{project_id}/characters/{character_id}/relations", response_model=CharacterRelationRead, status_code=status.HTTP_201_CREATED)
def create_relation_route(session: SessionDep, project_id: str, character_id: str, payload: CharacterRelationCreate) -> CharacterRelationRead:
    _project_or_404(session, project_id)
    if payload.source_character_id != character_id:
        raise_api_error(400, SOURCE_CHARACTER_ID_MUST_MATCH_ROUTE_CHARACTER)
    try:
        relation = create_relation(session, project_id, payload)
        rebuild_warnings(session, project_id)
        return relation
    except ValueError as exc:
        message = str(exc)
        if message == "relation_self_reference":
            raise_api_error(409, RELATION_SELF_REFERENCE)
        if message == "relation_missing_character":
            raise_api_error(404, RELATION_MISSING_CHARACTER)
        if message == "relation_conflict":
            raise_api_error(409, RELATION_CONFLICT)
        raise HTTPException(status_code=409, detail=message) from exc


@router.patch("/projects/{project_id}/characters/{character_id}/relations/{relation_id}", response_model=CharacterRelationRead)
def update_relation_route(session: SessionDep, project_id: str, character_id: str, relation_id: str, payload: CharacterRelationUpdate) -> CharacterRelationRead:
    _project_or_404(session, project_id)
    from kuti_backend.characters.models import CharacterRelation

    relation = session.get(CharacterRelation, relation_id)
    if (
        relation is None
        or relation.project_id != project_id
        or character_id not in {relation.source_character_id, relation.target_character_id}
    ):
        raise_api_error(404, RELATION_NOT_FOUND)
    updated = update_relation(session, relation, payload)
    rebuild_warnings(session, project_id)
    return updated


@router.delete("/projects/{project_id}/characters/{character_id}/relations/{relation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_relation_route(session: SessionDep, project_id: str, character_id: str, relation_id: str) -> None:
    _project_or_404(session, project_id)
    from kuti_backend.characters.models import CharacterRelation

    relation = session.get(CharacterRelation, relation_id)
    if (
        relation is None
        or relation.project_id != project_id
        or character_id not in {relation.source_character_id, relation.target_character_id}
    ):
        raise_api_error(404, RELATION_NOT_FOUND)
    delete_relation(session, relation)
    rebuild_warnings(session, project_id)


@router.post("/projects/{project_id}/characters/{character_id}/voice-samples", response_model=VoiceSampleRead, status_code=status.HTTP_201_CREATED)
def create_voice_sample_route(session: SessionDep, project_id: str, character_id: str, payload: VoiceSampleCreate) -> VoiceSampleRead:
    _project_or_404(session, project_id)
    _character_or_404(session, project_id, character_id)
    voice_sample = create_voice_sample(session, project_id, character_id, payload)
    rebuild_warnings(session, project_id)
    return voice_sample
