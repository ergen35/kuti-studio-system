-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "export_format" ADD VALUE 'paged_images';
ALTER TYPE "export_format" ADD VALUE 'pdf';
ALTER TYPE "export_format" ADD VALUE 'cbz';
ALTER TYPE "export_format" ADD VALUE 'epub';
