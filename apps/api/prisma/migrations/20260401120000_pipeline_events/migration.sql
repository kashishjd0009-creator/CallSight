-- CreateTable
CREATE TABLE "PipelineEvent" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "userId" TEXT,
    "uploadId" TEXT,
    "step" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT,
    "payload" JSONB,
    "durationMs" INTEGER,
    "httpMethod" TEXT,
    "httpPath" TEXT,
    "statusCode" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineEvent_correlationId_idx" ON "PipelineEvent"("correlationId");

-- CreateIndex
CREATE INDEX "PipelineEvent_userId_createdAt_idx" ON "PipelineEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PipelineEvent_step_createdAt_idx" ON "PipelineEvent"("step", "createdAt");
