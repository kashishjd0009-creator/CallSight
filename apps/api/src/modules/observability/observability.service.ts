import type { IObservabilityRepository } from "./observability.repository.js";
import type { ProbeViewerQuery, ProbeViewerQueryResult } from "./observability.repository.js";
import type { HttpProbeContext, PipelineEventCreateInput } from "./observability.types.js";
import { PipelineStep } from "./pipeline-steps.js";
import type { LogLevelName } from "./pipeline-steps.js";
import { redactPayload } from "./redaction.js";
import type { TerminalLogger } from "./terminal-logger.js";

export class ObservabilityService {
  constructor(
    private readonly repository: IObservabilityRepository,
    private readonly logger: TerminalLogger,
  ) {}

  async record(input: PipelineEventCreateInput): Promise<void> {
    if (typeof input.probeSpanId !== "string" || input.probeSpanId.trim() === "") {
      throw new Error("PipelineEvent requires a non-empty probeSpanId");
    }
    const safePayload =
      input.payload === undefined || input.payload === null
        ? undefined
        : redactPayload(input.payload);
    const row: PipelineEventCreateInput = {
      ...input,
      payload:
        safePayload === undefined || safePayload === null
          ? null
          : (safePayload as Record<string, unknown>),
    };
    try {
      await this.repository.create(row);
    } catch (err) {
      this.logger.error(
        {
          err,
          correlationId: row.correlationId,
          step: row.step,
          phase: row.phase,
        },
        "pipeline_event_persist_failed",
      );
      return;
    }

    const logLine = {
      correlationId: row.correlationId,
      step: row.step,
      phase: row.phase,
      durationMs: row.durationMs,
      errorCode: row.errorCode,
      statusCode: row.statusCode,
      payload: row.payload,
    };
    const level = row.level as LogLevelName;
    if (level === "error" || level === "fatal") {
      this.logger.error(logLine, row.message ?? `${row.step}:${row.phase}`);
    } else if (level === "warn") {
      this.logger.warn(logLine, row.message ?? `${row.step}:${row.phase}`);
    } else {
      this.logger.info(logLine, row.message ?? `${row.step}:${row.phase}`);
    }
  }

  async findForProbeViewer(query: ProbeViewerQuery): Promise<ProbeViewerQueryResult> {
    return this.repository.findForProbeViewer(query);
  }

  async recordHttpStart(ctx: HttpProbeContext): Promise<void> {
    await this.record({
      probeSpanId: ctx.probeSpanId,
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      uploadId: ctx.uploadId,
      step: PipelineStep.HTTP_REQUEST,
      phase: "before",
      level: "debug",
      message: "http_request_start",
      httpMethod: ctx.httpMethod ?? undefined,
      httpPath: ctx.httpPath ?? undefined,
      payload: { method: ctx.httpMethod, path: ctx.httpPath },
    });
  }

  async recordHttpEnd(
    ctx: HttpProbeContext,
    statusCode: number,
    durationMs: number,
  ): Promise<void> {
    await this.record({
      probeSpanId: ctx.probeSpanId,
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      uploadId: ctx.uploadId,
      step: PipelineStep.HTTP_REQUEST,
      phase: "after",
      level: statusCode >= 500 ? "error" : "info",
      message: "http_request_end",
      durationMs,
      statusCode,
      httpMethod: ctx.httpMethod ?? undefined,
      httpPath: ctx.httpPath ?? undefined,
      payload: { statusCode, durationMs },
    });
  }
}
