import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

import type { ObservabilityService } from "./observability.service.js";

export function createRequestContextMiddleware(obs: ObservabilityService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers["x-correlation-id"];
    const correlationId =
      typeof header === "string" && header.trim().length > 0 ? header.trim() : randomUUID();
    req.correlationId = correlationId;
    const httpProbeSpanId = randomUUID();
    req.httpProbeSpanId = httpProbeSpanId;

    const httpMethod = req.method;
    const httpPath = req.originalUrl?.split("?")[0] ?? req.path;

    // Avoid logging every admin probe list fetch — it floods the viewer with self-referential noise.
    const skipHttpPipelineLog = httpMethod === "GET" && httpPath === "/api/v1/probe/events";

    if (!skipHttpPipelineLog) {
      void obs
        .recordHttpStart({
          correlationId,
          httpMethod,
          httpPath,
          probeSpanId: httpProbeSpanId,
        })
        .catch(() => undefined);

      const started = Date.now();
      res.on("finish", () => {
        const durationMs = Date.now() - started;
        const spanId = req.httpProbeSpanId ?? httpProbeSpanId;
        const auth = (req as Request & { auth?: { userId?: string } }).auth;
        void obs
          .recordHttpEnd(
            {
              correlationId,
              userId: auth?.userId,
              httpMethod,
              httpPath,
              probeSpanId: spanId,
            },
            res.statusCode,
            durationMs,
          )
          .catch(() => undefined);
      });
    }

    next();
  };
}
