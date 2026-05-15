"""Repository functions for scene generation configuration and pages."""

from __future__ import annotations

from typing import Sequence
from uuid import uuid4

from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from kuti_backend.scene_generation.models import (
    SceneGenerationConfig,
    SceneMangaPage,
)
from kuti_backend.scene_generation.schemas import (
    SceneGenerationConfigCreate,
    SceneGenerationConfigUpdate,
    SceneMangaPageUpdate,
)


# =============================================================================
# SceneGenerationConfig Repository
# =============================================================================

def get_config(session: Session, project_id: str, config_id: str) -> SceneGenerationConfig | None:
    """Get a config by ID."""
    return session.scalar(
        select(SceneGenerationConfig).where(
            and_(
                SceneGenerationConfig.id == config_id,
                SceneGenerationConfig.project_id == project_id,
            )
        )
    )


def get_default_config(session: Session, project_id: str) -> SceneGenerationConfig | None:
    """Get the default config for a project."""
    return session.scalar(
        select(SceneGenerationConfig).where(
            and_(
                SceneGenerationConfig.project_id == project_id,
                SceneGenerationConfig.is_default == True,
            )
        )
    )


def list_configs(session: Session, project_id: str) -> Sequence[SceneGenerationConfig]:
    """List all configs for a project."""
    return session.scalars(
        select(SceneGenerationConfig)
        .where(SceneGenerationConfig.project_id == project_id)
        .order_by(SceneGenerationConfig.is_default.desc(), SceneGenerationConfig.name)
    ).all()


def create_config(
    session: Session, project_id: str, data: SceneGenerationConfigCreate
) -> SceneGenerationConfig:
    """Create a new config.
    
    If is_default=True, unset other defaults first.
    """
    # If setting as default, unset others
    if data.is_default:
        session.query(SceneGenerationConfig).where(
            SceneGenerationConfig.project_id == project_id
        ).update({"is_default": False})
    
    config = SceneGenerationConfig(
        id=str(uuid4()),
        project_id=project_id,
        name=data.name,
        is_default=data.is_default,
        system_prompt=data.system_prompt,
        style_preset=data.style_preset.value,
        color_mode=data.color_mode.value,
        default_image_count=data.default_image_count,
        allow_multi_page=data.allow_multi_page,
        metadata_json=data.metadata_json,
    )
    session.add(config)
    session.flush()
    return config


def update_config(
    session: Session, project_id: str, config_id: str, data: SceneGenerationConfigUpdate
) -> SceneGenerationConfig | None:
    """Update a config."""
    config = get_config(session, project_id, config_id)
    if not config:
        return None
    
    # Handle setting as default
    if data.is_default is True:
        session.query(SceneGenerationConfig).where(
            SceneGenerationConfig.project_id == project_id
        ).update({"is_default": False})
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(config, field, value)
    
    session.flush()
    return config


def delete_config(session: Session, project_id: str, config_id: str) -> bool:
    """Delete a config. Returns True if deleted."""
    config = get_config(session, project_id, config_id)
    if not config:
        return False
    
    session.delete(config)
    session.flush()
    return True


def set_default_config(session: Session, project_id: str, config_id: str) -> SceneGenerationConfig | None:
    """Set a config as default."""
    # Unset all defaults
    session.query(SceneGenerationConfig).where(
        SceneGenerationConfig.project_id == project_id
    ).update({"is_default": False})
    
    # Set new default
    config = get_config(session, project_id, config_id)
    if config:
        config.is_default = True
        session.flush()
    
    return config


# =============================================================================
# SceneMangaPage Repository
# =============================================================================

def get_page(session: Session, project_id: str, page_id: str) -> SceneMangaPage | None:
    """Get a page by ID."""
    return session.scalar(
        select(SceneMangaPage).where(
            and_(
                SceneMangaPage.id == page_id,
                SceneMangaPage.project_id == project_id,
            )
        )
    )


def get_page_by_panel(session: Session, panel_id: str) -> SceneMangaPage | None:
    """Get a page by its panel ID."""
    return session.scalar(
        select(SceneMangaPage).where(SceneMangaPage.panel_id == panel_id)
    )


def list_pages_for_scene(
    session: Session, project_id: str, scene_id: str
) -> Sequence[SceneMangaPage]:
    """List all manga pages for a scene."""
    return session.scalars(
        select(SceneMangaPage)
        .where(
            and_(
                SceneMangaPage.project_id == project_id,
                SceneMangaPage.scene_id == scene_id,
            )
        )
        .order_by(SceneMangaPage.page_number)
    ).all()


def create_page(
    session: Session,
    project_id: str,
    scene_id: str,
    tome_id: str,
    chapter_id: str,
    job_id: str,
    board_id: str,
    panel_id: str,
    page_number: int = 1,
    label: str = "",
) -> SceneMangaPage:
    """Create a new scene manga page record."""
    page = SceneMangaPage(
        id=str(uuid4()),
        project_id=project_id,
        scene_id=scene_id,
        tome_id=tome_id,
        chapter_id=chapter_id,
        job_id=job_id,
        board_id=board_id,
        panel_id=panel_id,
        page_number=page_number,
        label=label,
        status="draft",
    )
    session.add(page)
    session.flush()
    return page


def update_page(
    session: Session, project_id: str, page_id: str, data: SceneMangaPageUpdate
) -> SceneMangaPage | None:
    """Update a page."""
    page = get_page(session, project_id, page_id)
    if not page:
        return None
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(page, field, value)
    
    session.flush()
    return page


def delete_page(session: Session, project_id: str, page_id: str) -> bool:
    """Delete a page."""
    page = get_page(session, project_id, page_id)
    if not page:
        return False
    
    session.delete(page)
    session.flush()
    return True


def get_next_page_number(session: Session, scene_id: str) -> int:
    """Get the next page number for a scene."""
    result = session.scalar(
        select(SceneMangaPage.page_number)
        .where(SceneMangaPage.scene_id == scene_id)
        .order_by(SceneMangaPage.page_number.desc())
        .limit(1)
    )
    return (result or 0) + 1
