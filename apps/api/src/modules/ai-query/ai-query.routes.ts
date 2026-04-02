import type { PrismaClient } from "@prisma/client";
import { Router } from "express";

import { validateBody } from "../../core/validate.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { PrismaBillingRepository } from "../billing/billing.repository.js";
import { BillingService } from "../billing/billing.service.js";
import type { UploadTextStorage } from "../uploads/load-upload-records.js";
import type { ObservabilityService } from "../observability/observability.service.js";
import { AiQueryController } from "./ai-query.controller.js";
import { AiQueryService } from "./ai-query.service.js";
import { queryInputSchema } from "./ai-query.validators.js";
import { resolveReportingTimeZone } from "../analytics/reporting-timezone.js";
import { QueryExecutor } from "./query-executor.js";

export function createAiQueryRouter(
  jwtSecret: string,
  prisma: PrismaClient,
  storage: UploadTextStorage,
  geminiApiKey: string,
  observability: ObservabilityService,
): Router {
  const billingRepository = new PrismaBillingRepository(prisma);
  const queryExecutor = new QueryExecutor(resolveReportingTimeZone(process.env.ANALYTICS_TIMEZONE));
  const billingService = new BillingService(billingRepository);
  const aiQueryService = new AiQueryService(billingService, queryExecutor);
  const controller = new AiQueryController(
    aiQueryService,
    prisma,
    storage,
    geminiApiKey,
    billingService,
    observability,
  );

  const router = Router();
  router.post(
    "/:uploadId",
    requireAuth(jwtSecret),
    validateBody(queryInputSchema),
    controller.query,
  );
  router.get("/:uploadId/history", requireAuth(jwtSecret), controller.history);
  router.get("/usage", requireAuth(jwtSecret), controller.usage);
  return router;
}
