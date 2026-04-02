import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";
import { requireAdminEmail } from "../auth/admin-email.middleware.js";
import type { ObservabilityService } from "./observability.service.js";
import { ProbeViewerController } from "./probe-viewer.controller.js";

export function createProbeViewerRouter(
  jwtSecret: string,
  adminEmail: string,
  observability: ObservabilityService,
): Router {
  const router = Router();
  const controller = new ProbeViewerController(observability);

  router.get("/events", requireAuth(jwtSecret), requireAdminEmail(adminEmail), controller.list);
  return router;
}
