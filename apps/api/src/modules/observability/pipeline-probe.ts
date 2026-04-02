import { AppError } from "../../core/errors.js";
import { randomUUID } from "node:crypto";
import type { ObservabilityService } from "./observability.service.js";
import type { PipelineStepName } from "./pipeline-steps.js";
import type { ProbeContext } from "./observability.types.js";

export async function runProbe<T>(
  obs: ObservabilityService,
  ctx: ProbeContext,
  step: PipelineStepName,
  fn: () => Promise<T>,
  afterPayload?: (result: T) => Record<string, unknown> | undefined,
): Promise<T> {
  const t0 = Date.now();
  const probeSpanId = randomUUID();
  await obs.record({
    probeSpanId,
    correlationId: ctx.correlationId,
    userId: ctx.userId,
    uploadId: ctx.uploadId,
    step,
    phase: "before",
    level: "info",
    httpMethod: ctx.httpMethod ?? undefined,
    httpPath: ctx.httpPath ?? undefined,
    payload: {
      probePhase: "before",
      httpMethod: ctx.httpMethod ?? null,
      httpPath: ctx.httpPath ?? null,
      uploadId: ctx.uploadId ?? null,
    },
  });
  try {
    const result = await fn();
    const durationMs = Date.now() - t0;
    await obs.record({
      probeSpanId,
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      uploadId: ctx.uploadId,
      step,
      phase: "after",
      level: "info",
      durationMs,
      httpMethod: ctx.httpMethod ?? undefined,
      httpPath: ctx.httpPath ?? undefined,
      payload: afterPayload?.(result),
    });
    return result;
  } catch (e) {
    const durationMs = Date.now() - t0;
    const errorCode = e instanceof AppError ? e.code : e instanceof Error ? e.message : "UNKNOWN";
    await obs.record({
      probeSpanId,
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      uploadId: ctx.uploadId,
      step,
      phase: "error",
      level: "error",
      durationMs,
      errorCode,
      httpMethod: ctx.httpMethod ?? undefined,
      httpPath: ctx.httpPath ?? undefined,
      payload: { errorCode },
    });
    throw e;
  }
}
