-- CreateEnum
CREATE TYPE "character_image_kind" AS ENUM ('character_sheet', 'free_image');

-- AlterTable
ALTER TABLE "character_images" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kind" "character_image_kind" NOT NULL DEFAULT 'free_image',
ADD COLUMN     "source_image_id" TEXT;

-- CreateTable
CREATE TABLE "narrative_roles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narrative_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "narrative_roles_project_id_idx" ON "narrative_roles"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "narrative_roles_project_id_code_key" ON "narrative_roles"("project_id", "code");

-- CreateIndex
CREATE INDEX "character_images_character_id_kind_is_active_idx" ON "character_images"("character_id", "kind", "is_active");

-- CreateIndex
CREATE INDEX "character_images_source_image_id_idx" ON "character_images"("source_image_id");

-- AddForeignKey
ALTER TABLE "narrative_roles" ADD CONSTRAINT "narrative_roles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_images" ADD CONSTRAINT "character_images_source_image_id_fkey" FOREIGN KEY ("source_image_id") REFERENCES "character_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
