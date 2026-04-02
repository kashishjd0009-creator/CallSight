import type { PrismaClient } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";
import { PrismaBillingRepository } from "../billing/billing.repository.js";
import { BillingService } from "../billing/billing.service.js";
import { UserController } from "./user.controller.js";
import { PrismaUserRepository } from "./user.repository.js";

export function createUserRouter(jwtSecret: string, prisma: PrismaClient): Router {
  const billingService = new BillingService(new PrismaBillingRepository(prisma));
  const userRepository = new PrismaUserRepository(prisma);
  const controller = new UserController(userRepository, billingService);
  const router = Router();

  router.get("/me", requireAuth(jwtSecret), controller.getMe);
  router.patch("/me", requireAuth(jwtSecret), controller.patchMe);
  router.get("/me/tier", requireAuth(jwtSecret), controller.getTier);

  return router;
}
