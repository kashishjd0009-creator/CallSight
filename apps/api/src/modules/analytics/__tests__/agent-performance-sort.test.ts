import { describe, expect, it } from "vitest";

import { sortAgentPerformanceRows } from "../agent-performance-sort.js";

const row = (
  agentName: string,
  calls: number,
  totalTalk: number,
  avgTalk: number,
  avgWait: number,
  sharePct: number,
  shortCalls: number,
  extraLong: number,
) => ({
  agentName,
  calls,
  totalTalk,
  avgTalk,
  avgWait,
  sharePct,
  shortCalls,
  mediumCalls: 0,
  longCalls: 0,
  extraLongCalls: extraLong,
});

describe("sortAgentPerformanceRows", () => {
  const sample = [
    row("Zed", 10, 100, 10, 5, 10, 2, 1),
    row("Amy", 20, 80, 4, 2, 20, 10, 0),
    row("Ben", 15, 150, 10, 8, 15, 5, 2),
  ];

  it("sorts by calls descending", () => {
    const sorted = sortAgentPerformanceRows(sample, "calls", "desc");
    expect(sorted.map((r) => r.agentName)).toEqual(["Amy", "Ben", "Zed"]);
  });

  it("sorts by calls ascending", () => {
    const sorted = sortAgentPerformanceRows(sample, "calls", "asc");
    expect(sorted.map((r) => r.agentName)).toEqual(["Zed", "Ben", "Amy"]);
  });

  it("sorts by agentName ascending (case-insensitive)", () => {
    const sorted = sortAgentPerformanceRows(sample, "agentName", "asc");
    expect(sorted.map((r) => r.agentName)).toEqual(["Amy", "Ben", "Zed"]);
  });

  it("sorts by avgWait descending", () => {
    const sorted = sortAgentPerformanceRows(sample, "avgWait", "desc");
    expect(sorted.map((r) => r.agentName)).toEqual(["Ben", "Zed", "Amy"]);
  });

  it("uses agentName as tie-breaker when metric is equal", () => {
    const tie = [
      row("Zed", 10, 100, 10, 5, 10, 0, 0),
      row("Amy", 10, 100, 10, 5, 10, 0, 0),
      row("Ben", 10, 100, 10, 5, 10, 0, 0),
    ];
    const sorted = sortAgentPerformanceRows(tie, "calls", "desc");
    expect(sorted.map((r) => r.agentName)).toEqual(["Amy", "Ben", "Zed"]);
  });
});
