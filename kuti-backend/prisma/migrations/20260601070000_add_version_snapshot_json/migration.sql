-- Add snapshot storage for version checkpoints

ALTER TABLE "versions"
ADD COLUMN "snapshot_json" JSONB;
