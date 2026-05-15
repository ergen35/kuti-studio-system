"""Character-specific image generation helpers."""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session

from kuti_backend.core.settings import Settings, get_settings
from kuti_backend.generation.custom_generators import (
    CharacterImageStrategy,
    build_character_image_prompt,
)
from kuti_backend.generation.models import (
    GenerationBoard,
    GenerationBoardPanel,
    GenerationBoardStatus,
    GenerationJob,
    GenerationJobStatus,
    GenerationJobStep,
    GenerationPanelStatus,
    GenerationSourceKind,
    GenerationStepStatus,
    GenerationStrategy,
)
from kuti_backend.generation.providers import (
    ModelKind,
    generate_media_artifact,
    resolve_model_provider,
)
from kuti_backend.characters.models import Character, CharacterImage


logger = logging.getLogger(__name__)


def _generate_uuid() -> str:
    """Generate a UUID."""
    return str(uuid4())


def create_character_image_job(
    session: Session,
    settings: Settings,
    project_id: str,
    character_id: str,
    strategy: str,
    style: str,
    image_count: int = 1,
    model_key: str | None = None,
) -> GenerationJob:
    """Create a generation job for a character image."""
    logger.info(f"[CharacterImage] Starting image generation for character {character_id}")
    logger.info(f"[CharacterImage] Strategy: {strategy}, Style: {style}, Count: {image_count}")
    
    character = session.get(Character, character_id)
    if character is None or character.project_id != project_id:
        logger.error(f"[CharacterImage] Character not found: {character_id}")
        raise ValueError("character_not_found")
    
    logger.info(f"[CharacterImage] Character found: {character.name}")
    
    from kuti_backend.projects.models import Project
    project = session.get(Project, project_id)
    if project is None:
        logger.error(f"[CharacterImage] Project not found: {project_id}")
        raise ValueError("project_not_found")
    
    # Build strategy object
    image_strategy = CharacterImageStrategy(strategy=strategy, style=style, image_count=image_count)
    
    # Build prompt from character data
    prompt_result = build_character_image_prompt(character, image_strategy)
    logger.info(f"[CharacterImage] Generated prompt: {prompt_result['prompt'][:100]}...")
    logger.debug(f"[CharacterImage] Full prompt: {prompt_result['prompt']}")
    logger.debug(f"[CharacterImage] Negative prompt: {prompt_result['negative_prompt']}")
    
    # Create job
    job_id = _generate_uuid()
    board_id = _generate_uuid()
    now = datetime.now(timezone.utc)
    
    job = GenerationJob(
        id=job_id,
        project_id=project_id,
        source_kind=GenerationSourceKind.custom.value,
        source_id=character_id,
        source_label=f"{character.name} ({strategy}, {style})",
        source_version_id=None,
        strategy=GenerationStrategy.direct.value,
        entrypoint="gpt-2-images",
        title=prompt_result["title"],
        prompt=prompt_result["prompt"],
        summary=f"Character {character.name} - Strategy: {strategy}, Style: {style}",
        status=GenerationJobStatus.pending.value,
        progress=0,
        metadata_json={
            "source_kind": "character",
            "character_name": character.name,
            "strategy": strategy,
            "style": style,
            "image_count": image_count,
            "negative_prompt": prompt_result["negative_prompt"],
        },
        created_at=now,
        updated_at=now,
    )
    session.add(job)
    
    # Create board
    board = GenerationBoard(
        id=board_id,
        project_id=project_id,
        job_id=job_id,
        source_kind=GenerationSourceKind.custom.value,
        strategy=GenerationStrategy.direct.value,
        title=prompt_result["title"],
        summary=f"Image generation for character: {character.name}\nStrategy: {strategy}\nStyle: {style}",
        status=GenerationBoardStatus.draft.value,
        metadata_json={
            "character_id": character_id,
            "character_name": character.name,
            "strategy": strategy,
            "style": style,
        },
        created_at=now,
        updated_at=now,
    )
    session.add(board)
    
    logger.info(f"[CharacterImage] Job configured: board_id={board_id}")
    
    # Create panels and steps
    for i in range(image_count):
        panel_id = _generate_uuid()
        step_id = _generate_uuid()
        
        # Create step for this panel
        step = GenerationJobStep(
            id=step_id,
            job_id=job_id,
            order_index=i,
            title=f"Variation {i + 1}",
            status=GenerationStepStatus.pending.value,
            prompt=job.prompt,
            output_text="",
            metadata_json={
                "panel_index": i,
                "negative_prompt": prompt_result["negative_prompt"],
            },
            created_at=now,
            updated_at=now,
        )
        session.add(step)
        
        # Create panel - image path will be set during generation
        panel = GenerationBoardPanel(
            id=panel_id,
            board_id=board_id,
            step_id=step_id,
            order_index=i,
            title=f"{character.name} - {i + 1}",
            caption=job.prompt[:500] if len(job.prompt) > 500 else job.prompt,
            prompt=job.prompt,
            status=GenerationPanelStatus.draft.value,
            image_path="",  # Will be set during generation
            image_name=f"{character.slug}_{strategy}_{i + 1:03d}.png",
            metadata_json={
                "strategy": strategy,
                "style": style,
                "variation": i + 1,
            },
            created_at=now,
            updated_at=now,
        )
        session.add(panel)
        logger.debug(f"[CharacterImage] Created panel {i+1}: {panel_id}")
    
    # Commit everything before starting background thread
    session.commit()
    logger.info(f"[CharacterImage] Job {job_id} created and committed to database")
    
    # Start async generation - use sync engine for background thread
    logger.info(f"[CharacterImage] Starting background generation thread")
    _start_character_generation(
        job_id=job_id,
        board_id=board_id,
        project_id=project_id,
        character_id=character_id,
        project_slug=project.slug,
        character_slug=character.slug,
        image_count=image_count,
        strategy=strategy,
        style=style,
    )
    
    logger.info(f"[CharacterImage] Returning job {job_id}")
    return job


def _start_character_generation(
    job_id: str,
    board_id: str,
    project_id: str,
    character_id: str,
    project_slug: str,
    character_slug: str,
    image_count: int,
    strategy: str,
    style: str,
) -> None:
    """Start the actual image generation process in a background thread."""
    
    def generate_images():
        logger.info(f"[CharacterImage][Thread] Background generation started for job {job_id}")
        
        # Import here to avoid circular imports
        from kuti_backend.core.database import build_engine, build_session_factory
        from kuti_backend.core.settings import get_settings
        
        settings = get_settings()
        logger.debug(f"[CharacterImage][Thread] Settings loaded: data_dir={settings.data_dir}")
        
        engine = build_engine(settings)
        SessionLocal = build_session_factory(engine)
        session = SessionLocal()
        logger.info(f"[CharacterImage][Thread] Database session created")
        
        try:
            # Get job
            job = session.get(GenerationJob, job_id)
            if job is None:
                logger.error(f"[CharacterImage][Thread] Job {job_id} not found!")
                session.close()
                engine.dispose()
                return
            
            logger.info(f"[CharacterImage][Thread] Job found: {job.title}")
            logger.info(f"[CharacterImage][Thread] Updating status to 'running'")
            
            # Update job to running
            job.status = GenerationJobStatus.running.value
            job.updated_at = datetime.now(timezone.utc)
            session.commit()
            logger.info(f"[CharacterImage][Thread] Status updated to 'running'")
            
            # Setup assets directory
            assets_root = settings.assets_dir / project_slug / "characters" / character_slug / "images"
            assets_root.mkdir(parents=True, exist_ok=True)
            logger.info(f"[CharacterImage][Thread] Assets directory: {assets_root}")
            
            # Select model
            logger.info(f"[CharacterImage][Thread] Resolving AI model provider...")
            try:
                provider = resolve_model_provider(settings, None, kind=ModelKind.image)
                logger.info(f"[CharacterImage][Thread] Model provider: {provider.key} ({provider.display_name})")
            except Exception as e:
                logger.error(f"[CharacterImage][Thread] Failed to resolve model: {e}")
                raise
            
            # Generate images for each panel
            panels = session.query(GenerationBoardPanel).filter(
                GenerationBoardPanel.board_id == board_id
            ).order_by(GenerationBoardPanel.order_index).all()
            
            board = session.get(GenerationBoard, board_id)
            total = len(panels)
            logger.info(f"[CharacterImage][Thread] Starting generation of {total} images")
            
            for i, panel in enumerate(panels):
                step = session.get(GenerationJobStep, panel.step_id)
                if step is None:
                    logger.warning(f"[CharacterImage][Thread] Step not found for panel {panel.id}, skipping")
                    continue
                
                logger.info(f"[CharacterImage][Thread] Generating image {i+1}/{total} (Panel: {panel.id})")
                
                # Update progress
                progress = int((i / total) * 100)
                job.progress = progress
                job.updated_at = datetime.now(timezone.utc)
                step.status = GenerationStepStatus.running.value
                step.updated_at = datetime.now(timezone.utc)
                panel.status = GenerationPanelStatus.draft.value
                session.commit()
                logger.info(f"[CharacterImage][Thread] Progress: {progress}%")
                
                try:
                    # Generate image - incorporate negative prompt into main prompt if present
                    negative_prompt = step.metadata_json.get("negative_prompt", "")
                    base_prompt = f"{panel.prompt}\nVariation {i + 1} of {total}."
                    # Append negative prompt constraints to main prompt
                    if negative_prompt:
                        panel_prompt = f"{base_prompt}\nAvoid: {negative_prompt}"
                    else:
                        panel_prompt = base_prompt
                    
                    logger.info(f"[CharacterImage][Thread] Calling AI provider...")
                    logger.info(f"[CharacterImage][Thread] Provider: {provider.key}")
                    logger.info(f"[CharacterImage][Thread] Base URL: {provider.base_url}")
                    logger.info(f"[CharacterImage][Thread] API Model: {provider.api_model or provider.key}")
                    logger.debug(f"[CharacterImage][Thread] Prompt: {panel_prompt[:200]}...")
                    logger.debug(f"[CharacterImage][Thread] API Key (first 10 chars): {provider.api_key[:10] if provider.api_key else 'NONE'}...")
                    
                    artifact = generate_media_artifact(
                        provider=provider,
                        prompt=panel_prompt,
                    )
                    
                    logger.info(f"[CharacterImage][Thread] Image generated successfully ({len(artifact.content)} bytes)")
                    
                    # Generate filename with timestamp
                    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                    image_filename = f"{timestamp}_{character_slug}_{strategy}_{i + 1:03d}.png"
                    image_path = assets_root / image_filename
                    
                    # Save artifact
                    image_path.write_bytes(artifact.content)
                    logger.info(f"[CharacterImage][Thread] Image saved to: {image_path}")
                    
                    # Create CharacterImage entry
                    char_image = CharacterImage(
                        id=_generate_uuid(),
                        project_id=project_id,
                        character_id=character_id,
                        board_panel_id=panel.id,
                        file_path=str(image_path),
                        file_name=image_filename,
                        file_size=len(artifact.content),
                        mime_type=artifact.mime_type,
                        prompt=panel_prompt,
                        strategy=strategy,
                        style=style,
                        variation_index=i,
                        created_at=datetime.now(timezone.utc),
                    )
                    session.add(char_image)
                    
                    # Update panel
                    panel.image_path = str(image_path)
                    panel.status = GenerationPanelStatus.draft.value
                    panel.updated_at = datetime.now(timezone.utc)
                    
                    # Update step
                    step.status = GenerationStepStatus.ready.value
                    step.artifact_path = str(image_path)
                    step.artifact_name = image_filename
                    step.completed_at = datetime.now(timezone.utc)
                    step.updated_at = datetime.now(timezone.utc)
                    
                    session.commit()
                    logger.info(f"[CharacterImage][Thread] Database updated for image {i+1}")
                    
                except Exception as e:
                    logger.error(f"[CharacterImage][Thread] Failed to generate image {i+1}: {e}", exc_info=True)
                    step.status = GenerationStepStatus.failed.value
                    step.error_message = str(e)
                    step.updated_at = datetime.now(timezone.utc)
                    session.commit()
            
            # Update job as complete
            logger.info(f"[CharacterImage][Thread] All images processed. Updating job to 'ready'")
            job.status = GenerationJobStatus.ready.value
            job.progress = 100
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = datetime.now(timezone.utc)
            
            # Update board
            if board:
                board.status = GenerationBoardStatus.draft.value
                board.updated_at = datetime.now(timezone.utc)
            
            session.commit()
            logger.info(f"[CharacterImage][Thread] Job {job_id} completed successfully!")
            
        except Exception as e:
            logger.error(f"[CharacterImage][Thread] Critical error during generation: {e}", exc_info=True)
            # Try to update job as failed
            try:
                job = session.get(GenerationJob, job_id)
                if job:
                    job.status = GenerationJobStatus.failed.value
                    job.error_message = str(e)
                    job.failed_at = datetime.now(timezone.utc)
                    job.updated_at = datetime.now(timezone.utc)
                    session.commit()
                    logger.info(f"[CharacterImage][Thread] Job {job_id} marked as failed")
            except:
                logger.critical(f"[CharacterImage][Thread] Could not mark job as failed!")
        finally:
            session.close()
            engine.dispose()
            logger.info(f"[CharacterImage][Thread] Session closed, thread ending")
    
    # Run in background thread
    thread = threading.Thread(target=generate_images, daemon=True)
    thread.start()
    logger.info(f"[CharacterImage] Background thread started: {thread.name}")
