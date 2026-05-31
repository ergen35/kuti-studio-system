-- Extend generation sources for manga-page-to-drama workflows
ALTER TYPE "generation_source_kind" ADD VALUE IF NOT EXISTS 'manga_page';
ALTER TYPE "generation_source_kind" ADD VALUE IF NOT EXISTS 'drama_video';

-- CreateEnum
CREATE TYPE "drama_video_status" AS ENUM ('draft', 'queued', 'running', 'ready', 'failed', 'archived');

-- CreateTable
CREATE TABLE "drama_videos" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source_manga_page_id" TEXT,
    "job_id" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "model_key" TEXT NOT NULL DEFAULT '',
    "style_preset" TEXT NOT NULL DEFAULT 'korean_drama',
    "status" "drama_video_status" NOT NULL DEFAULT 'draft',
    "video_path" TEXT,
    "video_url" TEXT,
    "duration_seconds" INTEGER,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "drama_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drama_videos_project_id_idx" ON "drama_videos"("project_id");
CREATE INDEX "drama_videos_source_manga_page_id_idx" ON "drama_videos"("source_manga_page_id");
CREATE INDEX "drama_videos_job_id_idx" ON "drama_videos"("job_id");
CREATE INDEX "drama_videos_status_idx" ON "drama_videos"("status");

-- AddForeignKey
ALTER TABLE "drama_videos" ADD CONSTRAINT "drama_videos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drama_videos" ADD CONSTRAINT "drama_videos_source_manga_page_id_fkey" FOREIGN KEY ("source_manga_page_id") REFERENCES "scene_manga_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
