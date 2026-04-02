import type { PrismaClient } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";
import type { ObservabilityService } from "../observability/observability.service.js";
import type { UploadTextStorage } from "../uploads/load-upload-records.js";
import { AnalyticsController } from "./analytics.controller.js";

export function createAnalyticsRouter(
  jwtSecret: string,
  prisma: PrismaClient,
  storage: UploadTextStorage,
  observability: ObservabilityService,
): Router {
  const controller = new AnalyticsController(prisma, storage, observability);
  const router = Router();
  router.get("/:uploadId/dashboard", requireAuth(jwtSecret), controller.dashboard);
  router.get("/:uploadId/agents", requireAuth(jwtSecret), controller.agents);
  router.post("/:uploadId/compare", requireAuth(jwtSecret), controller.compare);
  return router;
}
