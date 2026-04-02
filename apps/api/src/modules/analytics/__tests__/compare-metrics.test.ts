import { describe, expect, it } from "vitest";

import { compareByDimension } from "../compare-metrics.js";
import type { CanonicalCallRecord } from "../analytics.types.js";

const base: CanonicalCallRecord[] = [
  { agentName: "A", queue: "Q1", talkTime: 100, waitTime: 5, disposition: "answered" },
  { agentName: "A", queue: "Q1", talkTime: 200, waitTime: 10, disposition: "answered" },
  { agentName: "B", queue: "Q2", talkTime: 50, waitTime: 30, disposition: "abandoned" },
];

describe("compareByDimension (scalar)", () => {
  it("compares agents by avg_talk_time with bar chartHint", () => {
    const r = compareByDimension(base, "agent", ["A", "B"], "avg_talk_time", "UTC");
    expect(r.mode).toBe("scalar");
    expect(r.chartHint).toBe("bar");
    expect(r.points).toEqual([
      { name: "A", value: 150 },
      { name: "B", value: 50 },
    ]);
  });

  it("compares queues by total_calls (integer bar height)", () => {
    const r = compareByDimension(base, "queue", ["Q1", "Q2"], "total_calls", "UTC");
    expect(r.mode).toBe("scalar");
    expect(r.chartHint).toBe("bar");
    expect(r.points).toEqual([
      { name: "Q1", value: 2 },
      { name: "Q2", value: 1 },
    ]);
  });

  it("returns zero for missing agent slice", () => {
    const r = compareByDimension(base, "agent", ["A", "Z"], "total_calls", "UTC");
    expect(r.points).toEqual([
      { name: "A", value: 2 },
      { name: "Z", value: 0 },
    ]);
  });
});
