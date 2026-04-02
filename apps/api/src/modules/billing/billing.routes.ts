import type { PrismaClient } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";
import { PrismaBillingRepository } from "./billing.repository.js";
import { BillingController } from "./billing.controller.js";
import { BillingService } from "./billing.service.js";

export function createBillingRouter(jwtSecret: string, prisma: PrismaClient): Router {
  const billingService = new BillingService(new PrismaBillingRepository(prisma));
  const controller = new BillingController(billingService);
  const router = Router();
  router.get("/usage", requireAuth(jwtSecret), controller.getUsage);
  return router;
}
