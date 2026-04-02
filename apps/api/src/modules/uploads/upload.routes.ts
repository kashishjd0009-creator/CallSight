import type { PrismaClient } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";
import type { ObservabilityService } from "../observability/observability.service.js";
import { PrismaUserRepository } from "../users/user.repository.js";
import { LocalStorageProvider } from "./local-storage.provider.js";
import { UploadController } from "./upload.controller.js";
import { PrismaUploadRepository } from "./upload.repository.js";

export function createUploadRouter(
  jwtSecret: string,
  prisma: PrismaClient,
  storage: LocalStorageProvider,
  observability: ObservabilityService,
): Router {
  const uploadRepository = new PrismaUploadRepository(prisma);
  const userRepository = new PrismaUserRepository(prisma);
  const controller = new UploadController(uploadRepository, storage, userRepository, observability);
  const router = Router();

  router.post("/", requireAuth(jwtSecret), controller.createUpload);
  router.get("/", requireAuth(jwtSecret), controller.listUploads);
  router.get("/:id", requireAuth(jwtSecret), controller.getUpload);
  router.delete("/:id", requireAuth(jwtSecret), controller.deleteUpload);

  return router;
}
