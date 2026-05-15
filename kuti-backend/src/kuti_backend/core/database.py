from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import re
from typing import Iterator

from fastapi import Request
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker

from kuti_backend.core.settings import Settings


def _database_path(settings: Settings) -> Path:
    db_dir = settings.data_dir / "db"
    db_dir.mkdir(parents=True, exist_ok=True)
    return db_dir / "kuti.sqlite"


@lru_cache(maxsize=8)
def get_engine(database_url: str) -> Engine:
    return create_engine(database_url, future=True, connect_args={"check_same_thread": False})


def build_engine(settings: Settings) -> Engine:
    return get_engine(f"sqlite:///{_database_path(settings)}")


def build_session_factory(engine: Engine):
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def _slugify(value: str, fallback: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return slug or fallback


def _ensure_sqlite_column(connection, table_name: str, column_name: str, ddl: str) -> None:
    existing_columns = {
        row["name"]
        for row in connection.execute(text(f'PRAGMA table_info("{table_name}")')).mappings()
    }
    if column_name not in existing_columns:
        connection.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {ddl}'))


def _next_unique_slug(used_slugs: set[str], base_slug: str) -> str:
    candidate = base_slug
    suffix = 2
    while candidate in used_slugs:
        candidate = f"{base_slug}-{suffix}"
        suffix += 1
    used_slugs.add(candidate)
    return candidate


def _repair_slug_table(connection, table_name: str, source_column: str, fallback: str, unique_scope_column: str | None = "project_id") -> None:
    _ensure_sqlite_column(connection, table_name, "slug", 'TEXT NOT NULL DEFAULT ""')

    columns = ["id", "slug", source_column]
    if unique_scope_column is not None:
        columns.insert(1, unique_scope_column)

    columns_sql = ", ".join(f'"{column}"' for column in columns)

    rows = connection.execute(
        text(f'SELECT {columns_sql} FROM "{table_name}" ORDER BY rowid')
    ).mappings().all()

    used_slugs_by_scope: dict[str, set[str]] = {}
    for row in rows:
        scope = str(row[unique_scope_column]) if unique_scope_column is not None else "__global__"
        used_slugs = used_slugs_by_scope.setdefault(scope, set())
        current_slug = str(row["slug"]).strip() if row["slug"] else ""
        source_value = str(row[source_column]).strip() if row[source_column] else ""
        base_slug = _slugify(source_value, fallback)
        if current_slug and current_slug not in used_slugs:
            used_slugs.add(current_slug)
            continue

        next_slug = _next_unique_slug(used_slugs, base_slug)
        connection.execute(
            text(f'UPDATE "{table_name}" SET slug = :slug WHERE id = :id'),
            {"slug": next_slug, "id": row["id"]},
        )


def _repair_sqlite_schema(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    with engine.begin() as connection:
        inspector = inspect(connection)
        existing_tables = set(inspector.get_table_names())

        if "projects" in existing_tables:
            _ensure_sqlite_column(connection, "projects", "slug", 'TEXT NOT NULL DEFAULT ""')
            _repair_slug_table(connection, "projects", "name", "project", unique_scope_column=None)
            connection.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS "uq_projects_slug" ON "projects" ("slug")'))

        if "characters" in existing_tables:
            _repair_slug_table(connection, "characters", "name", "character")
            connection.execute(
                text(
                    'CREATE UNIQUE INDEX IF NOT EXISTS "uq_characters_project_slug" '
                    'ON "characters" ("project_id", "slug")'
                )
            )

        if "assets" in existing_tables:
            _repair_slug_table(connection, "assets", "name", "asset")
            connection.execute(
                text(
                    'CREATE UNIQUE INDEX IF NOT EXISTS "uq_assets_project_slug" '
                    'ON "assets" ("project_id", "slug")'
                )
            )

        if "tomes" in existing_tables:
            _repair_slug_table(connection, "tomes", "title", "tome")
            connection.execute(
                text('CREATE UNIQUE INDEX IF NOT EXISTS "uq_tomes_project_slug" ON "tomes" ("project_id", "slug")')
            )

        if "chapters" in existing_tables:
            _repair_slug_table(connection, "chapters", "title", "chapter")
            connection.execute(
                text('CREATE UNIQUE INDEX IF NOT EXISTS "uq_chapters_project_slug" ON "chapters" ("project_id", "slug")')
            )

        if "scenes" in existing_tables:
            _repair_slug_table(connection, "scenes", "title", "scene")
            connection.execute(
                text('CREATE UNIQUE INDEX IF NOT EXISTS "uq_scenes_project_slug" ON "scenes" ("project_id", "slug")')
            )

        # Create character_images table if not exists (for existing databases)
        if "character_images" not in existing_tables:
            connection.execute(text('''
                CREATE TABLE "character_images" (
                    "id" VARCHAR(36) NOT NULL PRIMARY KEY,
                    "project_id" VARCHAR(36) NOT NULL,
                    "character_id" VARCHAR(36) NOT NULL,
                    "board_panel_id" VARCHAR(36),
                    "file_path" TEXT NOT NULL,
                    "file_name" VARCHAR(255) NOT NULL,
                    "file_size" INTEGER,
                    "mime_type" VARCHAR(64) DEFAULT 'image/png',
                    "prompt" TEXT DEFAULT '',
                    "strategy" VARCHAR(32),
                    "style" VARCHAR(32),
                    "variation_index" INTEGER,
                    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE ("character_id", "file_name")
                )
            '''))
            connection.execute(text('CREATE INDEX "ix_character_images_project_id" ON "character_images" ("project_id")'))
            connection.execute(text('CREATE INDEX "ix_character_images_character_id" ON "character_images" ("character_id")'))
            connection.execute(text('CREATE INDEX "ix_character_images_board_panel_id" ON "character_images" ("board_panel_id")'))


def get_session(request: Request) -> Iterator[Session]:
    session_factory = getattr(request.app.state, "session_factory", None)
    if session_factory is None:
        session_factory = build_session_factory(request.app.state.engine)
        request.app.state.session_factory = session_factory
    session: Session = session_factory()
    try:
        yield session
    finally:
        session.close()


def init_database(settings: Settings) -> Engine:
    from kuti_backend.projects.models import Base
    import kuti_backend.assets.models  # noqa: F401
    import kuti_backend.characters.models  # noqa: F401
    import kuti_backend.generation.models  # noqa: F401
    import kuti_backend.exports.models  # noqa: F401
    import kuti_backend.scene_generation.models  # noqa: F401
    import kuti_backend.story.models  # noqa: F401
    import kuti_backend.versions.models  # noqa: F401
    import kuti_backend.warnings.models  # noqa: F401

    engine = build_engine(settings)
    Base.metadata.create_all(bind=engine)
    _repair_sqlite_schema(engine)
    return engine
