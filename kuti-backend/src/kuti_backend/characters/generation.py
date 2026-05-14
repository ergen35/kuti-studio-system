"""Character-specific image generation helpers."""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session

from kuti_backend.core.settings import Settings
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
from kuti_backend.characters.models import Character


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
    """Create a generation job for a character image.
    
    Args:
        session: Database session
        settings: Application settings
        project_id: Project ID
        character_id: Character ID
        strategy: Image strategy (portrait, full_body, concept)
        style: Art style (realistic, anime, illustration, watercolor)
        image_count: Number of variations to generate
        model_key: Optional specific model key
        
    Returns:
        Created GenerationJob with board and panels
    """
    character = session.get(Character, character_id)
    if character is None or character.project_id != project_id:
        raise ValueError("character_not_found")
    
    # Get project for slug
    from kuti_backend.projects.models import Project
    project = session.get(Project, project_id)
    if project is None:
        raise ValueError("project_not_found")
    
    # Build strategy object
    image_strategy = CharacterImageStrategy(strategy=strategy, style=style, image_count=image_count)
    
    # Build prompt from character data
    prompt_result = build_character_image_prompt(character, image_strategy)
    
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
    
    # Use same path structure as main generation repository
    gen_root = settings.generation_dir / project.slug / job_id
    gen_root.mkdir(parents=True, exist_ok=True)
    
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
        
        # Create panel
        panel = GenerationBoardPanel(
            id=panel_id,
            board_id=board_id,
            step_id=step_id,
            order_index=i,
            title=f"{character.name} - {i + 1}",
            caption=job.prompt[:500] if len(job.prompt) > 500 else job.prompt,
            prompt=job.prompt,
            status=GenerationPanelStatus.draft.value,
            image_path=str(gen_root),
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
    
    session.commit()
    
    # Start async generation
    _start_character_generation(session, settings, job, board, character, image_count, gen_root)
    
    return job


def _start_character_generation(
    session: Session,
    settings: Settings,
    job: GenerationJob,
    board: GenerationBoard,
    character: Character,
    image_count: int,
    gen_root: Path,
) -> None:
    """Start the actual image generation process."""
    
    def generate_images():
        try:
            # Update job to running
            job.status = GenerationJobStatus.running.value
            job.updated_at = datetime.now(timezone.utc)
            session.commit()
            
            # Select model
            provider = resolve_model_provider(settings, None, kind=ModelKind.image)
            
            # Generate images for each panel
            panels = session.query(GenerationBoardPanel).filter(
                GenerationBoardPanel.board_id == board.id
            ).order_by(GenerationBoardPanel.order_index).all()
            
            total = len(panels)
            
            for i, panel in enumerate(panels):
                step = session.get(GenerationJobStep, panel.step_id)
                if step is None:
                    continue
                
                # Update progress
                progress = int((i / total) * 100)
                job.progress = progress
                job.updated_at = datetime.now(timezone.utc)
                step.status = GenerationStepStatus.running.value
                step.updated_at = datetime.now(timezone.utc)
                panel.status = GenerationPanelStatus.draft.value
                session.commit()
                
                try:
                    # Generate image
                    panel_prompt = f"{panel.prompt}\nVariation {i + 1} of {total}."
                    negative_prompt = step.metadata_json.get("negative_prompt", "")
                    
                    artifact = generate_media_artifact(
                        provider=provider,
                        model_kind=ModelKind.image,
                        prompt=panel_prompt,
                        negative_prompt=negative_prompt if negative_prompt else None,
                    )
                    
                    # Save artifact
                    image_path = gen_root / panel.image_name
                    image_path.write_bytes(artifact.content)
                    
                    # Update panel
                    panel.image_path = str(image_path)
                    panel.status = GenerationPanelStatus.draft.value
                    panel.updated_at = datetime.now(timezone.utc)
                    
                    # Update step
                    step.status = GenerationStepStatus.ready.value
                    step.artifact_path = str(image_path)
                    step.artifact_name = panel.image_name
                    step.completed_at = datetime.now(timezone.utc)
                    step.updated_at = datetime.now(timezone.utc)
                    
                    session.commit()
                    
                except Exception as e:
                    step.status = GenerationStepStatus.failed.value
                    step.error_message = str(e)
                    step.updated_at = datetime.now(timezone.utc)
                    session.commit()
            
            # Update job as complete
            job.status = GenerationJobStatus.ready.value
            job.progress = 100
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = datetime.now(timezone.utc)
            
            # Update board
            board.status = GenerationBoardStatus.draft.value
            board.updated_at = datetime.now(timezone.utc)
            
            session.commit()
            
        except Exception as e:
            job.status = GenerationJobStatus.failed.value
            job.error_message = str(e)
            job.failed_at = datetime.now(timezone.utc)
            job.updated_at = datetime.now(timezone.utc)
            session.commit()
    
    # Run in background thread
    thread = threading.Thread(target=generate_images, daemon=True)
    thread.start()
