import { describe, expect, it } from "vitest";

import type { CanonicalCallRecord } from "../analytics.types.js";
import { compareTimeSeriesByDimension } from "../compare-time-series.js";

describe("compareTimeSeriesByDimension", () => {
  it("returns mode time_series with line chartHint and one series per agent (hour bucket)", () => {
    const records: CanonicalCallRecord[] = [
      {
        agentName: "Amy",
        queue: "Q",
        talkTime: 100,
        dateTime: new Date("2026-04-01T10:00:00.000Z"),
      },
      {
        agentName: "Amy",
        queue: "Q",
        talkTime: 200,
        dateTime: new Date("2026-04-01T10:30:00.000Z"),
      },
      {
        agentName: "Bob",
        queue: "Q",
        talkTime: 50,
        dateTime: new Date("2026-04-01T10:00:00.000Z"),
      },
    ];
    const r = compareTimeSeriesByDimension(
      records,
      "agent",
      ["Amy", "Bob"],
      "talkTime",
      "hour",
      "UTC",
    );
    expect(r.mode).toBe("time_series");
    expect(r.chartHint).toBe("line");
    expect(r.column).toBe("talkTime");
    expect(r.bucket).toBe("hour");
    const amy = r.series.find((s) => s.name === "Amy");
    const bob = r.series.find((s) => s.name === "Bob");
    expect(amy?.points.some((p) => p.value === 150)).toBe(true);
    expect(bob?.points.some((p) => p.value === 50)).toBe(true);
  });

  it("excludes rows without dateTime from series computation", () => {
    const records: CanonicalCallRecord[] = [
      { agentName: "Amy", talkTime: 999 },
      { agentName: "Amy", talkTime: 100, dateTime: new Date("2026-04-01T12:00:00.000Z") },
      { agentName: "Bob", talkTime: 100, dateTime: new Date("2026-04-01T12:00:00.000Z") },
    ];
    const r = compareTimeSeriesByDimension(
      records,
      "agent",
      ["Amy", "Bob"],
      "talkTime",
      "hour",
      "UTC",
    );
    const amy = r.series.find((s) => s.name === "Amy");
    expect(amy?.points.length).toBeGreaterThan(0);
    expect(amy?.points.every((p) => p.value !== 999)).toBe(true);
  });

  it("buckets by day in reporting timezone", () => {
    const records: CanonicalCallRecord[] = [
      { agentName: "Amy", talkTime: 60, dateTime: new Date("2026-04-01T08:00:00.000Z") },
      { agentName: "Amy", talkTime: 100, dateTime: new Date("2026-04-02T08:00:00.000Z") },
    ];
    const r = compareTimeSeriesByDimension(records, "agent", ["Amy"], "talkTime", "day", "UTC");
    expect(r.bucket).toBe("day");
    expect(r.series[0]?.points.length).toBe(2);
  });

  it("uses waitTime column when selected", () => {
    const records: CanonicalCallRecord[] = [
      { agentName: "Amy", waitTime: 10, dateTime: new Date("2026-04-01T15:00:00.000Z") },
    ];
    const r = compareTimeSeriesByDimension(records, "agent", ["Amy"], "waitTime", "hour", "UTC");
    expect(r.column).toBe("waitTime");
    expect(r.series[0]?.points[0]?.value).toBe(10);
  });

  it("returns empty points for agent with no rows in slice", () => {
    const records: CanonicalCallRecord[] = [
      { agentName: "Amy", talkTime: 1, dateTime: new Date("2026-04-01T10:00:00.000Z") },
    ];
    const r = compareTimeSeriesByDimension(
      records,
      "agent",
      ["Amy", "Nobody"],
      "talkTime",
      "hour",
      "UTC",
    );
    const nobody = r.series.find((s) => s.name === "Nobody");
    expect(nobody?.points).toEqual([]);
  });

  it("coalesces missing numeric field to 0", () => {
    const records: CanonicalCallRecord[] = [
      { agentName: "Amy", talkTime: undefined, dateTime: new Date("2026-04-01T10:00:00.000Z") },
      { agentName: "Amy", talkTime: 100, dateTime: new Date("2026-04-01T10:00:00.000Z") },
    ];
    const r = compareTimeSeriesByDimension(records, "agent", ["Amy"], "talkTime", "hour", "UTC");
    const pt = r.series[0]?.points.find(
      (p) => p.bucketKey.includes("10") || p.label.includes("10"),
    );
    expect(pt?.value).toBe(50);
  });

  it("works for dimension queue", () => {
    const records: CanonicalCallRecord[] = [
      { queue: "Sales", talkTime: 10, dateTime: new Date("2026-04-01T10:00:00.000Z") },
      { queue: "Support", talkTime: 20, dateTime: new Date("2026-04-01T10:00:00.000Z") },
    ];
    const r = compareTimeSeriesByDimension(
      records,
      "queue",
      ["Sales", "Support"],
      "talkTime",
      "hour",
      "UTC",
    );
    expect(r.series).toHaveLength(2);
  });
});
