-- AlterTable
ALTER TABLE "PipelineEvent" ADD COLUMN     "probeSpanId" TEXT;

-- CreateIndex
CREATE INDEX "PipelineEvent_probeSpanId_idx" ON "PipelineEvent"("probeSpanId");
