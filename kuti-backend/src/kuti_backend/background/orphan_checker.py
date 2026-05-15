"""Background worker to check for orphaned character images."""

import logging
from datetime import UTC, datetime
from pathlib import Path
from threading import Thread
from time import sleep
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from kuti_backend.core.database import build_engine
from kuti_backend.core.settings import get_settings
from kuti_backend.characters.models import CharacterImage
from kuti_backend.warnings.models import Warning

logger = logging.getLogger(__name__)


def _fingerprint_orphan(image_id: str) -> str:
    return f"orphan_character_image::{image_id}"


def check_orphan_images(session: Session) -> list[Warning]:
    """Find all character images where file is missing but DB entry exists."""
    warnings_to_create: list[Warning] = []
    
    # Get all character images
    images = list(session.scalars(select(CharacterImage)))
    
    for image in images:
        file_path = Path(image.file_path)
        if not file_path.exists():
            logger.warning(f"[OrphanChecker] Orphan detected: {image.id} - {image.file_path}")
            
            fingerprint = _fingerprint_orphan(image.id)
            
            # Check if warning already exists
            existing = session.scalar(
                select(Warning).where(
                    Warning.project_id == image.project_id,
                    Warning.fingerprint == fingerprint
                )
            )
            
            if existing:
                if existing.status == "resolved":
                    # Re-open if it was resolved
                    existing.status = "open"
                    existing.resolved_at = None
                    existing.updated_at = datetime.now(UTC)
                    existing.message = f"L'image du personnage '{image.file_name}' est référencée en base mais le fichier est manquant. Chemin: {image.file_path}"
                    existing.metadata_json = {
                        "image_id": image.id,
                        "character_id": image.character_id,
                        "file_path": image.file_path,
                        "file_name": image.file_name,
                        "prompt": image.prompt,
                        "strategy": image.strategy,
                        "style": image.style,
                    }
                    warnings_to_create.append(existing)
            else:
                # Create new warning
                warning = Warning(
                    id=str(uuid4()),
                    project_id=image.project_id,
                    fingerprint=fingerprint,
                    kind="orphan_character_image",
                    severity="warning",
                    status="open",
                    title=f"Image manquante: {image.file_name}",
                    message=f"L'image du personnage '{image.file_name}' est référencée en base mais le fichier est manquant. Chemin: {image.file_path}",
                    entity_kind="character_image",
                    entity_id=image.id,
                    metadata_json={
                        "image_id": image.id,
                        "character_id": image.character_id,
                        "file_path": image.file_path,
                        "file_name": image.file_name,
                        "prompt": image.prompt,
                        "strategy": image.strategy,
                        "style": image.style,
                    },
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                warnings_to_create.append(warning)
                session.add(warning)
    
    session.commit()
    return warnings_to_create


def start_orphan_checker_thread(interval_seconds: int = 3600) -> Thread:
    """Start background thread that checks for orphan images every hour."""
    
    def run_checker():
        # Wait a bit for app to fully start
        sleep(5)
        
        settings = get_settings()
        engine = build_engine(settings)
        SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        
        while True:
            try:
                logger.info("[OrphanChecker] Starting check...")
                with SessionLocal() as session:
                    warnings = check_orphan_images(session)
                    if warnings:
                        logger.info(f"[OrphanChecker] Created/updated {len(warnings)} warnings")
                    else:
                        logger.info("[OrphanChecker] No orphan images found")
            except Exception as e:
                logger.error(f"[OrphanChecker] Error during check: {e}", exc_info=True)
            
            sleep(interval_seconds)
    
    thread = Thread(target=run_checker, daemon=True, name="OrphanChecker")
    thread.start()
    logger.info(f"[OrphanChecker] Background thread started (interval: {interval_seconds}s)")
    return thread
