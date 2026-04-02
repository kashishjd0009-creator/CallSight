import { describe, expect, it } from "vitest";

import { mapEventsToProbeRows, type ProbeEventRow } from "../probe-viewer.mapper.js";

describe("mapEventsToProbeRows", () => {
  it("maps before/after into one row by probeSpanId", () => {
    const input: ProbeEventRow[] = [
      {
        id: "1",
        probeSpanId: "s1",
        correlationId: "c1",
        step: "ANALYTICS_FILTER",
        phase: "before",
        level: "info",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        payload: { in: true },
      },
      {
        id: "2",
        probeSpanId: "s1",
        correlationId: "c1",
        step: "ANALYTICS_FILTER",
        phase: "after",
        level: "info",
        createdAt: new Date("2026-04-01T10:00:01.000Z"),
        payload: { out: true },
      },
    ];
    const rows = mapEventsToProbeRows(input);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.probeSpanId).toBe("s1");
    expect(rows[0]?.userId).toBeNull();
    expect(rows[0]?.before?.payload).toEqual({ in: true });
    expect(rows[0]?.after?.payload).toEqual({ out: true });
    expect(rows[0]?.error).toBeNull();
  });

  it("resolves span userId from after when before is null (typical HTTP_REQUEST)", () => {
    const input: ProbeEventRow[] = [
      {
        id: "1",
        probeSpanId: "http1",
        correlationId: "c-http",
        userId: null,
        step: "HTTP_REQUEST",
        phase: "before",
        level: "debug",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        payload: { method: "GET", path: "/api/v1/foo" },
      },
      {
        id: "2",
        probeSpanId: "http1",
        correlationId: "c-http",
        userId: "user-uuid-1",
        step: "HTTP_REQUEST",
        phase: "after",
        level: "info",
        createdAt: new Date("2026-04-01T10:00:00.050Z"),
        payload: { statusCode: 200, durationMs: 50 },
      },
    ];
    const rows = mapEventsToProbeRows(input);
    expect(rows[0]?.userId).toBe("user-uuid-1");
    expect(rows[0]?.before?.userId).toBeNull();
    expect(rows[0]?.after?.userId).toBe("user-uuid-1");
  });

  it("keeps error phase alongside before/after for same span", () => {
    const input: ProbeEventRow[] = [
      {
        id: "1",
        probeSpanId: "s2",
        correlationId: "c2",
        step: "AI_QUERY_EXECUTE",
        phase: "before",
        level: "info",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        payload: { started: true },
      },
      {
        id: "2",
        probeSpanId: "s2",
        correlationId: "c2",
        step: "AI_QUERY_EXECUTE",
        phase: "error",
        level: "error",
        createdAt: new Date("2026-04-01T10:00:01.000Z"),
        payload: { code: "FAIL" },
      },
    ];
    const rows = mapEventsToProbeRows(input);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.before?.phase).toBe("before");
    expect(rows[0]?.after).toBeNull();
    expect(rows[0]?.error?.phase).toBe("error");
  });
});
