-- Drop span-less rows (cannot be paired in the probe viewer).
DELETE FROM "PipelineEvent" WHERE "probeSpanId" IS NULL;

-- AlterTable
ALTER TABLE "PipelineEvent" ALTER COLUMN "probeSpanId" SET NOT NULL;
