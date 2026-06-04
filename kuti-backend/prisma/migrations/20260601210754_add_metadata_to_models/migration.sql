-- AlterTable
ALTER TABLE "scene_manga_pages" ADD COLUMN     "metadata_json" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "metadata_json" JSONB NOT NULL DEFAULT '{}';
