import type { LogLevelName, PipelinePhase, PipelineStepName } from "./pipeline-steps.js";

/** Context for pipeline steps; span id is generated inside `runProbe`, not read from here. */
export type ProbeContext = {
  correlationId: string;
  userId?: string | null;
  uploadId?: string | null;
  httpMethod?: string | null;
  httpPath?: string | null;
};

/** HTTP_REQUEST before/after must share this span id (set by request-context middleware). */
export type HttpProbeContext = ProbeContext & {
  probeSpanId: string;
};

export type PipelineEventCreateInput = {
  probeSpanId: string;
  correlationId: string;
  userId?: string | null;
  uploadId?: string | null;
  step: PipelineStepName;
  phase: PipelinePhase;
  level: LogLevelName;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  durationMs?: number | null;
  httpMethod?: string | null;
  httpPath?: string | null;
  statusCode?: number | null;
  errorCode?: string | null;
};
