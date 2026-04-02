import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { Express } from "express";

import { loadEnv } from "./config/env.js";
import { errorMiddleware } from "./core/error-middleware.js";
import { prisma } from "./lib/prisma.js";
import { createAiQueryRouter } from "./modules/ai-query/ai-query.routes.js";
import { createAnalyticsRouter } from "./modules/analytics/analytics.routes.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createBillingRouter } from "./modules/billing/billing.routes.js";
import { PrismaObservabilityRepository } from "./modules/observability/observability.repository.js";
import { ObservabilityService } from "./modules/observability/observability.service.js";
import { createRequestContextMiddleware } from "./modules/observability/request-context.middleware.js";
import { createTerminalLogger } from "./modules/observability/terminal-logger.js";
import { createProbeViewerRouter } from "./modules/observability/probe-viewer.routes.js";
import {
  LocalStorageProvider,
  defaultUploadsRoot,
} from "./modules/uploads/local-storage.provider.js";
import { createUploadRouter } from "./modules/uploads/upload.routes.js";
import { createUserRouter } from "./modules/users/user.routes.js";

const env = loadEnv();
const app: Express = express();
const storage = new LocalStorageProvider(defaultUploadsRoot());
const terminalLogger = createTerminalLogger(env.LOG_LEVEL);
const observabilityRepository = new PrismaObservabilityRepository(prisma);
const observabilityService = new ObservabilityService(observabilityRepository, terminalLogger);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(createRequestContextMiddleware(observabilityService));

app.use(
  "/api/v1/auth",
  createAuthRouter(env.JWT_SECRET, env.JWT_REFRESH_SECRET, prisma, observabilityService),
);
app.use("/api/v1/users", createUserRouter(env.JWT_SECRET, prisma));
app.use(
  "/api/v1/uploads",
  createUploadRouter(env.JWT_SECRET, prisma, storage, observabilityService),
);
app.use(
  "/api/v1/analytics",
  createAnalyticsRouter(env.JWT_SECRET, prisma, storage, observabilityService),
);
app.use(
  "/api/v1/query",
  createAiQueryRouter(env.JWT_SECRET, prisma, storage, env.GEMINI_API_KEY, observabilityService),
);
app.use("/api/v1/billing", createBillingRouter(env.JWT_SECRET, prisma));
app.use(
  "/api/v1/probe",
  createProbeViewerRouter(env.JWT_SECRET, env.ADMIN_EMAIL, observabilityService),
);

app.use(errorMiddleware);

if (process.env.NODE_ENV !== "test") {
  app.listen(Number(env.PORT), () => {
    console.log(`CallSight API listening on port ${env.PORT}`);
  });
}

export { app };
