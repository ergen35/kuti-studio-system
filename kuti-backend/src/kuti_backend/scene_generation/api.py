"""API routes for scene manga generation."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from kuti_backend.core.database import get_session
from kuti_backend.scene_generation import (
    repository as scene_gen_repo,
    service as scene_gen_service,
)
from kuti_backend.scene_generation.schemas import (
    SceneGenerationConfigCreate,
    SceneGenerationConfigUpdate,
    SceneGenerationConfigRead,
    SceneGenerateRequest,
    SceneGenerateResponse,
    SceneMangaPageRead,
    SceneMangaPageUpdate,
    PromptPreviewRequest,
    PromptPreviewResponse,
    SceneGenerationListResponse,
)
from kuti_backend.projects.repository import get_project
from typing import Annotated

router = APIRouter(prefix="/projects/{project_id}/story/scenes/{scene_id}")

SessionDep = Annotated[Session, Depends(get_session)]


# =============================================================================
# Config Management Routes
# =============================================================================

@router.get("/generation-configs", response_model=list[SceneGenerationConfigRead])
def list_generation_configs(
    project_id: str,
    session: SessionDep,
) -> list[SceneGenerationConfigRead]:
    """List all generation configs for a project."""
    # Verify project exists
    project = get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    configs = scene_gen_repo.list_configs(session, project_id)
    return [SceneGenerationConfigRead.model_validate(c) for c in configs]


@router.post(
    "/generation-configs",
    response_model=SceneGenerationConfigRead,
    status_code=status.HTTP_201_CREATED,
)
def create_generation_config(
    project_id: str,
    data: SceneGenerationConfigCreate,
    session: SessionDep,
) -> SceneGenerationConfigRead:
    """Create a new generation config."""
    project = get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    config = scene_gen_repo.create_config(session, project_id, data)
    session.commit()
    return SceneGenerationConfigRead.model_validate(config)


@router.get("/generation-configs/{config_id}", response_model=SceneGenerationConfigRead)
def get_generation_config(
    project_id: str,
    config_id: str,
    session: SessionDep,
) -> SceneGenerationConfigRead:
    """Get a specific generation config."""
    config = scene_gen_repo.get_config(session, project_id, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return SceneGenerationConfigRead.model_validate(config)


@router.patch("/generation-configs/{config_id}", response_model=SceneGenerationConfigRead)
def update_generation_config(
    project_id: str,
    config_id: str,
    data: SceneGenerationConfigUpdate,
    session: SessionDep,
) -> SceneGenerationConfigRead:
    """Update a generation config."""
    config = scene_gen_repo.update_config(session, project_id, config_id, data)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    session.commit()
    return SceneGenerationConfigRead.model_validate(config)


@router.delete("/generation-configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_generation_config(
    project_id: str,
    config_id: str,
    session: SessionDep,
) -> None:
    """Delete a generation config."""
    deleted = scene_gen_repo.delete_config(session, project_id, config_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Config not found")
    session.commit()


@router.post("/generation-configs/{config_id}/set-default", response_model=SceneGenerationConfigRead)
def set_default_config(
    project_id: str,
    config_id: str,
    session: SessionDep,
) -> SceneGenerationConfigRead:
    """Set a config as the default for the project."""
    config = scene_gen_repo.set_default_config(session, project_id, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    session.commit()
    return SceneGenerationConfigRead.model_validate(config)


# =============================================================================
# Generation Routes
# =============================================================================

@router.post("/generate", response_model=SceneGenerateResponse)
async def generate_scene_manga(
    project_id: str,
    scene_id: str,
    request: SceneGenerateRequest,
    session: SessionDep,
) -> SceneGenerateResponse:
    """Generate manga page(s) from a scene.
    
    This creates a generation job that will be processed asynchronously.
    The job ID can be used to poll for status via the regular generation API.
    """
    try:
        result = await scene_gen_service.generate_scene_manga(
            session, project_id, scene_id, request
        )
        session.commit()
        return SceneGenerateResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/preview-prompt", response_model=PromptPreviewResponse)
async def preview_generation_prompt(
    project_id: str,
    scene_id: str,
    request: PromptPreviewRequest,
    session: SessionDep,
) -> PromptPreviewResponse:
    """Preview the prompt that would be generated without actually running generation.
    
    Useful for debugging and verifying character references before committing credits.
    """
    try:
        preview = await scene_gen_service.preview_scene_generation(
            session,
            project_id,
            scene_id,
            request.config_id,
            request.character_image_refs,
            request.additional_context,
        )
        return preview
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# =============================================================================
# Generated Pages Routes
# =============================================================================

@router.get("/manga-pages", response_model=SceneGenerationListResponse)
def list_scene_manga_pages(
    project_id: str,
    scene_id: str,
    session: SessionDep,
) -> SceneGenerationListResponse:
    """List all manga pages generated for this scene."""
    from kuti_backend.story.repository import get_scene
    
    # Verify scene exists
    scene = get_scene(session, project_id, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    pages = scene_gen_repo.list_pages_for_scene(session, project_id, scene_id)
    
    # Enrich with panel details
    page_reads = []
    for page in pages:
        # Get panel details
        panel = session.get(GenerationBoardPanel, page.panel_id)
        if panel:
            page_data = SceneMangaPageRead(
                id=page.id,
                project_id=page.project_id,
                scene_id=page.scene_id,
                tome_id=page.tome_id,
                chapter_id=page.chapter_id,
                job_id=page.job_id,
                board_id=page.board_id,
                panel_id=page.panel_id,
                page_number=page.page_number,
                label=page.label,
                status=page.status,
                image_url=f"/api/projects/{project_id}/generation/boards/{page.board_id}/panels/{page.panel_id}/image",
                caption=panel.caption,
                prompt=panel.prompt,
                created_at=page.created_at,
                updated_at=page.updated_at,
            )
            page_reads.append(page_data)
    
    return SceneGenerationListResponse(
        scene_id=scene_id,
        pages=page_reads,
        total_pages=len(page_reads),
    )


@router.get("/manga-pages/{page_id}", response_model=SceneMangaPageRead)
def get_scene_manga_page(
    project_id: str,
    scene_id: str,
    page_id: str,
    session: SessionDep,
) -> SceneMangaPageRead:
    """Get a specific manga page."""
    page = scene_gen_repo.get_page(session, project_id, page_id)
    if not page or page.scene_id != scene_id:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Get panel details
    from kuti_backend.generation.models import GenerationBoardPanel
    panel = session.get(GenerationBoardPanel, page.panel_id)
    
    return SceneMangaPageRead(
        id=page.id,
        project_id=page.project_id,
        scene_id=page.scene_id,
        tome_id=page.tome_id,
        chapter_id=page.chapter_id,
        job_id=page.job_id,
        board_id=page.board_id,
        panel_id=page.panel_id,
        page_number=page.page_number,
        label=page.label,
        status=page.status,
        image_url=f"/api/projects/{project_id}/generation/boards/{page.board_id}/panels/{page.panel_id}/image" if panel else None,
        caption=panel.caption if panel else None,
        prompt=panel.prompt if panel else None,
        created_at=page.created_at,
        updated_at=page.updated_at,
    )


@router.patch("/manga-pages/{page_id}", response_model=SceneMangaPageRead)
def update_scene_manga_page(
    project_id: str,
    scene_id: str,
    page_id: str,
    data: SceneMangaPageUpdate,
    session: SessionDep,
) -> SceneMangaPageRead:
    """Update a manga page (label, status, etc.)."""
    page = scene_gen_repo.update_page(session, project_id, page_id, data)
    if not page or page.scene_id != scene_id:
        raise HTTPException(status_code=404, detail="Page not found")
    session.commit()
    
    # Return updated page
    return get_scene_manga_page(project_id, scene_id, page_id, session)


@router.delete("/manga-pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scene_manga_page(
    project_id: str,
    scene_id: str,
    page_id: str,
    session: SessionDep,
) -> None:
    """Delete a manga page reference (does not delete the underlying image)."""
    page = scene_gen_repo.get_page(session, project_id, page_id)
    if not page or page.scene_id != scene_id:
        raise HTTPException(status_code=404, detail="Page not found")
    
    scene_gen_repo.delete_page(session, project_id, page_id)
    session.commit()


# Need this import at the bottom to avoid circular imports
from kuti_backend.generation.models import GenerationBoardPanel
