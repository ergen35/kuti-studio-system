-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('draft', 'active', 'archived', 'maintenance');

-- CreateEnum
CREATE TYPE "character_status" AS ENUM ('active', 'draft', 'archived');

-- CreateEnum
CREATE TYPE "story_status" AS ENUM ('active', 'draft', 'archived');

-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "generation_source_kind" AS ENUM ('scene', 'chapter', 'tome', 'panel', 'custom');

-- CreateEnum
CREATE TYPE "generation_strategy" AS ENUM ('direct', 'intermediate');

-- CreateEnum
CREATE TYPE "generation_job_status" AS ENUM ('pending', 'running', 'ready', 'validated', 'failed');

-- CreateEnum
CREATE TYPE "generation_step_status" AS ENUM ('pending', 'running', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "generation_board_status" AS ENUM ('draft', 'validated');

-- CreateEnum
CREATE TYPE "generation_panel_status" AS ENUM ('draft', 'selected', 'rejected', 'replaced');

-- CreateEnum
CREATE TYPE "style_preset" AS ENUM ('shonen', 'shojo', 'seinen', 'generic');

-- CreateEnum
CREATE TYPE "color_mode" AS ENUM ('bw', 'color', 'spot_color');

-- CreateEnum
CREATE TYPE "manga_page_status" AS ENUM ('draft', 'selected', 'rejected');

-- CreateEnum
CREATE TYPE "warning_severity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "warning_status" AS ENUM ('open', 'ignored', 'resolved');

-- CreateEnum
CREATE TYPE "export_format" AS ENUM ('json', 'tree', 'zip');

-- CreateEnum
CREATE TYPE "export_kind" AS ENUM ('work', 'publication');

-- CreateEnum
CREATE TYPE "export_status" AS ENUM ('pending', 'ready', 'failed');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "project_status" NOT NULL DEFAULT 'draft',
    "root_path" TEXT NOT NULL,
    "settings_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_opened_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT,
    "narrative_role" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "physical_description" TEXT NOT NULL DEFAULT '',
    "color_palette_json" JSONB NOT NULL DEFAULT '[]',
    "costume_elements_json" JSONB NOT NULL DEFAULT '[]',
    "key_traits_json" JSONB NOT NULL DEFAULT '[]',
    "personality" TEXT NOT NULL DEFAULT '',
    "narrative_arc" TEXT NOT NULL DEFAULT '',
    "tags_json" JSONB NOT NULL DEFAULT '[]',
    "status" "character_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_relations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source_character_id" TEXT NOT NULL,
    "target_character_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "strength" INTEGER NOT NULL DEFAULT 50,
    "narrative_dependency" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_samples" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "asset_path" TEXT,
    "label" TEXT NOT NULL,
    "voice_notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_images" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "board_panel_id" TEXT,
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT NOT NULL DEFAULT 'image/png',
    "prompt" TEXT NOT NULL DEFAULT '',
    "strategy" TEXT,
    "style" TEXT,
    "variation_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tomes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL DEFAULT '',
    "status" "story_status" NOT NULL DEFAULT 'draft',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "tome_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL DEFAULT '',
    "status" "story_status" NOT NULL DEFAULT 'draft',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "tome_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "scene_type" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "characters_json" JSONB NOT NULL DEFAULT '[]',
    "tags_json" JSONB NOT NULL DEFAULT '[]',
    "status" "story_status" NOT NULL DEFAULT 'draft',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_references" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "reference_kind" TEXT NOT NULL,
    "target_slug" TEXT NOT NULL,
    "raw_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tags_json" JSONB NOT NULL DEFAULT '[]',
    "status" "asset_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_links" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "target_kind" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source_kind" "generation_source_kind" NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_label" TEXT NOT NULL,
    "source_version_id" TEXT,
    "strategy" "generation_strategy" NOT NULL,
    "entrypoint" TEXT NOT NULL DEFAULT 'gpt-2-images',
    "title" TEXT NOT NULL DEFAULT 'Generation job',
    "prompt" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "status" "generation_job_status" NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_job_steps" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "status" "generation_step_status" NOT NULL DEFAULT 'pending',
    "prompt" TEXT NOT NULL DEFAULT '',
    "output_text" TEXT NOT NULL DEFAULT '',
    "artifact_path" TEXT,
    "artifact_name" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "generation_job_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_boards" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "source_kind" "generation_source_kind" NOT NULL,
    "strategy" "generation_strategy" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "status" "generation_board_status" NOT NULL DEFAULT 'draft',
    "artifact_path" TEXT,
    "artifact_name" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "validated_at" TIMESTAMP(3),

    CONSTRAINT "generation_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_board_panels" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "step_id" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT NOT NULL DEFAULT '',
    "status" "generation_panel_status" NOT NULL DEFAULT 'draft',
    "image_path" TEXT NOT NULL,
    "image_name" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_board_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_generation_configs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "system_prompt" TEXT NOT NULL,
    "style_preset" "style_preset" NOT NULL DEFAULT 'generic',
    "color_mode" "color_mode" NOT NULL DEFAULT 'bw',
    "default_image_count" INTEGER NOT NULL DEFAULT 4,
    "allow_multi_page" BOOLEAN NOT NULL DEFAULT false,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_generation_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_manga_pages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "tome_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "panel_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "manga_page_status" NOT NULL DEFAULT 'draft',
    "image_url" TEXT,
    "caption" TEXT,
    "prompt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_manga_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "version_index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warnings" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" "warning_severity" NOT NULL,
    "status" "warning_status" NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entity_kind" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_records" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" "export_kind" NOT NULL,
    "format" "export_format" NOT NULL,
    "status" "export_status" NOT NULL DEFAULT 'pending',
    "label" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "artifact_path" TEXT,
    "artifact_name" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "export_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "characters_project_id_idx" ON "characters"("project_id");

-- CreateIndex
CREATE INDEX "characters_slug_idx" ON "characters"("slug");

-- CreateIndex
CREATE INDEX "characters_name_idx" ON "characters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "characters_project_id_slug_key" ON "characters"("project_id", "slug");

-- CreateIndex
CREATE INDEX "character_relations_project_id_idx" ON "character_relations"("project_id");

-- CreateIndex
CREATE INDEX "character_relations_source_character_id_idx" ON "character_relations"("source_character_id");

-- CreateIndex
CREATE INDEX "character_relations_target_character_id_idx" ON "character_relations"("target_character_id");

-- CreateIndex
CREATE INDEX "voice_samples_project_id_idx" ON "voice_samples"("project_id");

-- CreateIndex
CREATE INDEX "voice_samples_character_id_idx" ON "voice_samples"("character_id");

-- CreateIndex
CREATE INDEX "character_images_project_id_idx" ON "character_images"("project_id");

-- CreateIndex
CREATE INDEX "character_images_character_id_idx" ON "character_images"("character_id");

-- CreateIndex
CREATE INDEX "character_images_board_panel_id_idx" ON "character_images"("board_panel_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_images_character_id_file_name_key" ON "character_images"("character_id", "file_name");

-- CreateIndex
CREATE INDEX "tomes_project_id_idx" ON "tomes"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "tomes_project_id_slug_key" ON "tomes"("project_id", "slug");

-- CreateIndex
CREATE INDEX "chapters_project_id_idx" ON "chapters"("project_id");

-- CreateIndex
CREATE INDEX "chapters_tome_id_idx" ON "chapters"("tome_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_project_id_slug_key" ON "chapters"("project_id", "slug");

-- CreateIndex
CREATE INDEX "scenes_project_id_idx" ON "scenes"("project_id");

-- CreateIndex
CREATE INDEX "scenes_tome_id_idx" ON "scenes"("tome_id");

-- CreateIndex
CREATE INDEX "scenes_chapter_id_idx" ON "scenes"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "scenes_project_id_slug_key" ON "scenes"("project_id", "slug");

-- CreateIndex
CREATE INDEX "story_references_project_id_idx" ON "story_references"("project_id");

-- CreateIndex
CREATE INDEX "story_references_scene_id_idx" ON "story_references"("scene_id");

-- CreateIndex
CREATE INDEX "assets_project_id_idx" ON "assets"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_project_id_slug_key" ON "assets"("project_id", "slug");

-- CreateIndex
CREATE INDEX "asset_links_project_id_idx" ON "asset_links"("project_id");

-- CreateIndex
CREATE INDEX "asset_links_asset_id_idx" ON "asset_links"("asset_id");

-- CreateIndex
CREATE INDEX "asset_links_target_id_idx" ON "asset_links"("target_id");

-- CreateIndex
CREATE INDEX "generation_jobs_project_id_idx" ON "generation_jobs"("project_id");

-- CreateIndex
CREATE INDEX "generation_jobs_source_kind_idx" ON "generation_jobs"("source_kind");

-- CreateIndex
CREATE INDEX "generation_jobs_source_id_idx" ON "generation_jobs"("source_id");

-- CreateIndex
CREATE INDEX "generation_jobs_source_version_id_idx" ON "generation_jobs"("source_version_id");

-- CreateIndex
CREATE INDEX "generation_jobs_strategy_idx" ON "generation_jobs"("strategy");

-- CreateIndex
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs"("status");

-- CreateIndex
CREATE INDEX "generation_job_steps_job_id_idx" ON "generation_job_steps"("job_id");

-- CreateIndex
CREATE INDEX "generation_job_steps_status_idx" ON "generation_job_steps"("status");

-- CreateIndex
CREATE UNIQUE INDEX "generation_boards_job_id_key" ON "generation_boards"("job_id");

-- CreateIndex
CREATE INDEX "generation_boards_project_id_idx" ON "generation_boards"("project_id");

-- CreateIndex
CREATE INDEX "generation_boards_source_kind_idx" ON "generation_boards"("source_kind");

-- CreateIndex
CREATE INDEX "generation_boards_strategy_idx" ON "generation_boards"("strategy");

-- CreateIndex
CREATE INDEX "generation_boards_status_idx" ON "generation_boards"("status");

-- CreateIndex
CREATE INDEX "generation_board_panels_board_id_idx" ON "generation_board_panels"("board_id");

-- CreateIndex
CREATE INDEX "generation_board_panels_step_id_idx" ON "generation_board_panels"("step_id");

-- CreateIndex
CREATE INDEX "generation_board_panels_status_idx" ON "generation_board_panels"("status");

-- CreateIndex
CREATE INDEX "scene_generation_configs_project_id_idx" ON "scene_generation_configs"("project_id");

-- CreateIndex
CREATE INDEX "scene_manga_pages_project_id_idx" ON "scene_manga_pages"("project_id");

-- CreateIndex
CREATE INDEX "scene_manga_pages_scene_id_idx" ON "scene_manga_pages"("scene_id");

-- CreateIndex
CREATE INDEX "scene_manga_pages_tome_id_idx" ON "scene_manga_pages"("tome_id");

-- CreateIndex
CREATE INDEX "scene_manga_pages_chapter_id_idx" ON "scene_manga_pages"("chapter_id");

-- CreateIndex
CREATE INDEX "scene_manga_pages_job_id_idx" ON "scene_manga_pages"("job_id");

-- CreateIndex
CREATE INDEX "scene_manga_pages_board_id_idx" ON "scene_manga_pages"("board_id");

-- CreateIndex
CREATE INDEX "versions_project_id_idx" ON "versions"("project_id");

-- CreateIndex
CREATE INDEX "versions_branch_name_idx" ON "versions"("branch_name");

-- CreateIndex
CREATE INDEX "warnings_project_id_idx" ON "warnings"("project_id");

-- CreateIndex
CREATE INDEX "warnings_severity_idx" ON "warnings"("severity");

-- CreateIndex
CREATE INDEX "warnings_status_idx" ON "warnings"("status");

-- CreateIndex
CREATE INDEX "warnings_kind_idx" ON "warnings"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "warnings_project_id_fingerprint_key" ON "warnings"("project_id", "fingerprint");

-- CreateIndex
CREATE INDEX "export_records_project_id_idx" ON "export_records"("project_id");

-- CreateIndex
CREATE INDEX "export_records_status_idx" ON "export_records"("status");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_source_character_id_fkey" FOREIGN KEY ("source_character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_target_character_id_fkey" FOREIGN KEY ("target_character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_images" ADD CONSTRAINT "character_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_images" ADD CONSTRAINT "character_images_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tomes" ADD CONSTRAINT "tomes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_tome_id_fkey" FOREIGN KEY ("tome_id") REFERENCES "tomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_tome_id_fkey" FOREIGN KEY ("tome_id") REFERENCES "tomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_references" ADD CONSTRAINT "story_references_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_references" ADD CONSTRAINT "story_references_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_links" ADD CONSTRAINT "asset_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_links" ADD CONSTRAINT "asset_links_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_job_steps" ADD CONSTRAINT "generation_job_steps_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_boards" ADD CONSTRAINT "generation_boards_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_boards" ADD CONSTRAINT "generation_boards_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_board_panels" ADD CONSTRAINT "generation_board_panels_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "generation_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_generation_configs" ADD CONSTRAINT "scene_generation_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_manga_pages" ADD CONSTRAINT "scene_manga_pages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions" ADD CONSTRAINT "versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_records" ADD CONSTRAINT "export_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
