import type { PrismaClient } from "@prisma/client";
import type { CookieOptions } from "express";
import { Router } from "express";
import rateLimit from "express-rate-limit";

import { validateBody } from "../../core/validate.js";
import type { ObservabilityService } from "../observability/observability.service.js";
import { AuthController } from "./auth.controller.js";
import { PrismaAuthRepository } from "./auth.repository.js";
import { requireAuth } from "./auth.middleware.js";
import { AuthService } from "./auth.service.js";
import { changePasswordSchema, loginSchema, registerSchema } from "./auth.validators.js";

class NoopEmailSender {
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    void email;
    void token;
    return;
  }

  async sendResetPasswordEmail(email: string, token: string): Promise<void> {
    void email;
    void token;
    return;
  }
}

export function createAuthRouter(
  jwtSecret: string,
  jwtRefreshSecret: string,
  prisma: PrismaClient,
  observability: ObservabilityService,
  authCookieOptions: CookieOptions,
): Router {
  const repository = new PrismaAuthRepository(prisma);
  const service = new AuthService(repository, new NoopEmailSender(), {
    jwtSecret,
    jwtRefreshSecret,
    accessTokenTtlSeconds: 15 * 60,
    refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
    passwordResetTtlSeconds: 60 * 60,
  });
  const controller = new AuthController(service, observability, authCookieOptions);

  const router = Router();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.post("/register", authLimiter, validateBody(registerSchema), controller.register);
  router.post("/login", authLimiter, validateBody(loginSchema), controller.login);
  router.post("/logout", controller.logout);
  router.post("/refresh", authLimiter, controller.refresh);
  router.post("/forgot-password", authLimiter, controller.forgotPassword);
  router.post("/reset-password", authLimiter, controller.resetPassword);
  router.post(
    "/change-password",
    requireAuth(jwtSecret),
    authLimiter,
    validateBody(changePasswordSchema),
    controller.changePassword,
  );
  router.get("/verify-email/:token", controller.verifyEmail);
  router.get("/me", requireAuth(jwtSecret), controller.me);

  return router;
}
