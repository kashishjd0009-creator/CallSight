type ProbePhase = "before" | "after" | "error";

export type ProbeEventRow = {
  id: string;
  probeSpanId: string;
  correlationId: string;
  userId?: string | null;
  step: string;
  phase: ProbePhase;
  level: string;
  message?: string | null;
  payload?: unknown;
  durationMs?: number | null;
  statusCode?: number | null;
  errorCode?: string | null;
  createdAt: Date;
};

type ProbeEventLite = {
  id: string;
  phase: ProbePhase;
  level: string;
  message?: string | null;
  payload?: unknown;
  durationMs?: number | null;
  statusCode?: number | null;
  errorCode?: string | null;
  createdAt: string;
  /** Present when the backend stored a user id for this phase (often null on HTTP_REQUEST before). */
  userId?: string | null;
};

export type ProbeViewerRow = {
  probeSpanId: string;
  correlationId: string;
  /** Best-known user id for this span (prefers after → error → before → any row). */
  userId: string | null;
  step: string;
  createdAt: string;
  before: ProbeEventLite | null;
  after: ProbeEventLite | null;
  error: ProbeEventLite | null;
};

function toLite(event: ProbeEventRow): ProbeEventLite {
  return {
    id: event.id,
    phase: event.phase,
    level: event.level,
    message: event.message ?? null,
    payload: event.payload,
    durationMs: event.durationMs ?? null,
    statusCode: event.statusCode ?? null,
    errorCode: event.errorCode ?? null,
    createdAt: event.createdAt.toISOString(),
    userId: event.userId ?? null,
  };
}

/** Prefer phases where auth/context is usually attached (HTTP after, then error, then before). */
function resolveSpanUserId(spanEvents: ProbeEventRow[]): string | null {
  const uid = (phase: ProbePhase) =>
    spanEvents.find((e) => e.phase === phase && e.userId)?.userId ?? null;
  return (
    uid("after") ??
    uid("error") ??
    uid("before") ??
    spanEvents.find((e) => e.userId)?.userId ??
    null
  );
}

export function mapEventsToProbeRows(events: ProbeEventRow[]): ProbeViewerRow[] {
  const bySpan = new Map<string, ProbeEventRow[]>();
  for (const event of events) {
    const rows = bySpan.get(event.probeSpanId) ?? [];
    rows.push(event);
    bySpan.set(event.probeSpanId, rows);
  }

  const output: ProbeViewerRow[] = [];
  for (const [probeSpanId, spanEvents] of bySpan.entries()) {
    spanEvents.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const before = spanEvents.find((e) => e.phase === "before") ?? null;
    const after = spanEvents.find((e) => e.phase === "after") ?? null;
    const error = spanEvents.find((e) => e.phase === "error") ?? null;
    const anchor = error ?? after ?? before ?? spanEvents[spanEvents.length - 1] ?? null;
    if (!anchor) {
      continue;
    }
    output.push({
      probeSpanId,
      correlationId: anchor.correlationId,
      userId: resolveSpanUserId(spanEvents),
      step: anchor.step,
      createdAt: anchor.createdAt.toISOString(),
      before: before ? toLite(before) : null,
      after: after ? toLite(after) : null,
      error: error ? toLite(error) : null,
    });
  }

  output.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return output;
}
