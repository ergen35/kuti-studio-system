"""Service layer for scene manga generation.

Orchestrates the generation workflow by:
1. Resolving scene and character references
2. Building the prompt
3. Creating the generation job
4. Linking results to the scene
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy.orm import Session

from kuti_backend.scene_generation import repository as scene_gen_repo
from kuti_backend.scene_generation.prompt_builder import (
    build_scene_prompt,
    preview_scene_prompt,
    DEFAULT_MANGA_BW_SYSTEM_PROMPT,
)
from kuti_backend.scene_generation.schemas import (
    SceneGenerateRequest,
    PromptPreviewResponse,
)
from kuti_backend.scene_generation.models import SceneGenerationConfig

from kuti_backend.story.repository import get_scene
from kuti_backend.characters.repository import get_character_by_slug
from kuti_backend.characters.models import CharacterImage

from kuti_backend.generation.models import (
    GenerationJob,
    GenerationJobStatus,
    GenerationBoard,
    GenerationBoardPanel,
)

if TYPE_CHECKING:
    from kuti_backend.story.models import Scene
    from kuti_backend.characters.models import Character


# =============================================================================
# Character Resolution
# =============================================================================

def resolve_scene_characters(
    session: Session,
    project_id: str,
    scene: Scene,
) -> list[Character]:
    """Resolve character slugs in scene to full Character objects.
    
    Args:
        session: Database session
        project_id: Project ID
        scene: Scene with characters_json
        
    Returns:
        List of Character objects found
    """
    characters = []
    
    for slug in scene.characters_json or []:
        character = get_character_by_slug(session, project_id, slug)
        if character:
            characters.append(character)
    
    return characters


def resolve_character_reference_images(
    session: Session,
    project_id: str,
    characters: list[Character],
    explicit_refs: dict[str, str] | None = None,
) -> dict[str, CharacterImage]:
    """Get the best reference image for each character.
    
    Priority:
    1. Explicitly specified image ID
    2. Most recent generated character image
    3. None (will proceed without visual reference)
    
    Args:
        session: Database session
        project_id: Project ID
        characters: List of characters
        explicit_refs: Optional dict of slug -> image_id overrides
        
    Returns:
        Dict mapping character slug to CharacterImage
    """
    from sqlalchemy import select
    from kuti_backend.characters.models import CharacterImage
    
    result = {}
    explicit_refs = explicit_refs or {}
    
    for character in characters:
        # Check for explicit override
        if character.slug in explicit_refs:
            image_id = explicit_refs[character.slug]
            image = session.scalar(
                select(CharacterImage).where(
                    CharacterImage.id == image_id,
                    CharacterImage.character_id == character.id,
                )
            )
            if image:
                result[character.slug] = image
                continue
        
        # Get most recent image for this character
        latest_image = session.scalar(
            select(CharacterImage)
            .where(
                CharacterImage.character_id == character.id,
                CharacterImage.project_id == project_id,
            )
            .order_by(CharacterImage.created_at.desc())
            .limit(1)
        )
        
        if latest_image:
            result[character.slug] = latest_image
    
    return result


# =============================================================================
# Configuration Resolution
# =============================================================================

def resolve_generation_config(
    session: Session,
    project_id: str,
    config_id: str | None = None,
) -> SceneGenerationConfig:
    """Get the config to use for generation.
    
    If config_id is provided, uses that config.
    Otherwise, uses the project's default config.
    If no default exists, creates a temporary default config.
    
    Args:
        session: Database session
        project_id: Project ID
        config_id: Optional specific config ID
        
    Returns:
        SceneGenerationConfig to use
    """
    config = None
    
    if config_id:
        config = scene_gen_repo.get_config(session, project_id, config_id)
    
    if not config:
        config = scene_gen_repo.get_default_config(session, project_id)
    
    if not config:
        # Create a temporary default config
        # Note: This won't be persisted unless explicitly saved
        config = SceneGenerationConfig(
            id=str(uuid4()),
            project_id=project_id,
            name="Manga Noir & Blanc (Default)",
            is_default=True,
            system_prompt=DEFAULT_MANGA_BW_SYSTEM_PROMPT,
            style_preset="generic",
            color_mode="bw",
            default_image_count=1,
            allow_multi_page=True,
        )
    
    return config


# =============================================================================
# Generation Workflow
# =============================================================================

async def generate_scene_manga(
    session: Session,
    project_id: str,
    scene_id: str,
    request: SceneGenerateRequest,
) -> dict:
    """Generate manga pages from a scene.
    
    This is the main orchestration function that:
    1. Resolves all references (scene, characters, config)
    2. Builds the prompt
    3. Creates a generation job
    4. Returns job info for polling
    
    Args:
        session: Database session
        project_id: Project ID
        scene_id: Scene ID to generate from
        request: Generation request parameters
        
    Returns:
        Dict with job_id and status info
        
    Raises:
        ValueError: If scene not found or invalid configuration
    """
    # 1. Resolve scene
    scene = get_scene(session, project_id, scene_id)
    if not scene:
        raise ValueError(f"Scene {scene_id} not found")
    
    # 2. Resolve config
    config = resolve_generation_config(session, project_id, request.config_id)
    
    # 3. Resolve characters
    characters = resolve_scene_characters(session, project_id, scene)
    character_images = resolve_character_reference_images(
        session,
        project_id,
        characters,
        request.character_image_refs,
    )
    
    # 4. Build the prompt
    prompt = build_scene_prompt(
        scene,
        config,
        characters,
        character_images,
        request.additional_context,
    )
    
    # 5. Create generation job
    # Determine entrypoint based on config
    entrypoint = "gpt-2-images"  # Default for GPT Image 2
    
    job = GenerationJob(
        id=str(uuid4()),
        project_id=project_id,
        source_kind="scene",  # New source kind for scene manga
        source_id=scene_id,
        source_label=f"Scene: {scene.title}",
        strategy="direct",
        entrypoint=entrypoint,
        title=f"Manga: {scene.title}",
        prompt=prompt,
        summary=f"Generation of {request.image_count} manga page(s) for scene '{scene.title}'",
        status=GenerationJobStatus.pending.value,
        progress=0,
        metadata_json={
            "scene_context": {
                "tome_id": scene.tome_id,
                "chapter_id": scene.chapter_id,
                "scene_id": scene_id,
                "scene_title": scene.title,
                "config_id": config.id,
                "config_name": config.name,
                "image_count": request.image_count,
                "character_slugs": [c.slug for c in characters],
                "color_mode": config.color_mode,
                "style_preset": config.style_preset,
            }
        },
    )
    
    session.add(job)
    session.flush()
    
    # Note: The actual generation is handled by the background worker
    # which will pick up this job and process it
    
    return {
        "job_id": job.id,
        "status": job.status,
        "message": f"Generation job started for {request.image_count} manga page(s)",
        "prompt_preview": prompt[:500] + "..." if len(prompt) > 500 else prompt,
    }


async def preview_scene_generation(
    session: Session,
    project_id: str,
    scene_id: str,
    config_id: str | None = None,
    character_image_refs: dict[str, str] | None = None,
    additional_context: str = "",
) -> PromptPreviewResponse:
    """Preview the prompt that would be generated without actually running generation.
    
    Args:
        session: Database session
        project_id: Project ID
        scene_id: Scene ID
        config_id: Optional config ID
        character_image_refs: Optional image reference overrides
        additional_context: Optional additional context
        
    Returns:
        PromptPreviewResponse with preview details
        
    Raises:
        ValueError: If scene not found
    """
    # Resolve all references
    scene = get_scene(session, project_id, scene_id)
    if not scene:
        raise ValueError(f"Scene {scene_id} not found")
    
    config = resolve_generation_config(session, project_id, config_id)
    characters = resolve_scene_characters(session, project_id, scene)
    character_images = resolve_character_reference_images(
        session,
        project_id,
        characters,
        character_image_refs,
    )
    
    # Generate preview
    preview = preview_scene_prompt(
        scene,
        config,
        characters,
        character_images,
        additional_context,
    )
    
    return PromptPreviewResponse(**preview)


# =============================================================================
# Post-Generation Linking
# =============================================================================

def link_generation_result_to_scene(
    session: Session,
    project_id: str,
    scene_id: str,
    job_id: str,
    board_id: str,
    panel_id: str,
) -> None:
    """Create a SceneMangaPage record linking a generation result to a scene.
    
    This should be called by the background worker after a panel is generated.
    
    Args:
        session: Database session
        project_id: Project ID
        scene_id: Scene ID
        job_id: Generation job ID
        board_id: Generation board ID
        panel_id: Generation panel ID (the actual image)
    """
    scene = get_scene(session, project_id, scene_id)
    if not scene:
        return
    
    # Get next page number for this scene
    page_number = scene_gen_repo.get_next_page_number(session, scene_id)
    
    # Create the link record
    label = f"T?-C?-S? P.{page_number}"  # Will be updated with actual numbers
    
    scene_gen_repo.create_page(
        session=session,
        project_id=project_id,
        scene_id=scene_id,
        tome_id=scene.tome_id,
        chapter_id=scene.chapter_id,
        job_id=job_id,
        board_id=board_id,
        panel_id=panel_id,
        page_number=page_number,
        label=label,
    )
