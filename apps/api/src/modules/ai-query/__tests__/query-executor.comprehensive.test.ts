import { describe, expect, it } from "vitest";

import { QueryExecutor } from "../query-executor.js";
import type { ParsedQuery } from "../query.types.js";

function q(metric: ParsedQuery["metric"], overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return {
    metric,
    filters: { agentName: null, queue: null, dateRange: { from: null, to: null }, hour: null },
    parameters: { n: 5 },
    visualizationType: "number",
    naturalLanguageDescription: "test",
    ...overrides,
  };
}

const mixedAgents = [
  {
    agentName: "A",
    queue: "Q1",
    talkTime: 100,
    waitTime: 5,
    disposition: "answered",
    dateTime: new Date("2026-04-01T10:00:00.000Z"),
  },
  {
    agentName: "B",
    queue: "Q1",
    talkTime: 200,
    waitTime: 25,
    disposition: "abandoned",
    dateTime: new Date("2026-04-01T11:00:00.000Z"),
  },
  {
    agentName: "A",
    queue: "Q2",
    talkTime: 50,
    waitTime: 30,
    disposition: "answered",
    dateTime: new Date("2026-04-02T09:00:00.000Z"),
  },
];

describe("QueryExecutor — comprehensive (volume & global)", () => {
  const ex = new QueryExecutor("UTC");

  it("total_wait_time sums waitTime with coalesce", () => {
    expect(ex.execute(q("total_wait_time"), mixedAgents).value).toBe(60);
  });

  it("total_hold_time returns 0 and dataUnavailable when hold never mapped", () => {
    const r = ex.execute(q("total_hold_time"), mixedAgents);
    expect(r.value).toBe(0);
    expect(r.dataUnavailable).toBe(true);
  });

  it("total_wrap_time returns 0 and dataUnavailable when wrap never mapped", () => {
    const r = ex.execute(q("total_wrap_time"), mixedAgents);
    expect(r.value).toBe(0);
    expect(r.dataUnavailable).toBe(true);
  });

  it("total_hold_time sums when holdTime present on any row", () => {
    const rows = [{ ...mixedAgents[0], holdTime: 12 }];
    expect(ex.execute(q("total_hold_time"), rows as typeof mixedAgents).value).toBe(12);
  });

  it("service_level_pct is % of calls with wait <= 20s", () => {
    expect(ex.execute(q("service_level_pct"), mixedAgents).value).toBe(33.33);
  });

  it("short_call_rate uses talk < 30s", () => {
    const rows = [{ talkTime: 10 }, { talkTime: 100 }];
    expect(ex.execute(q("short_call_rate"), rows).value).toBe(50);
  });

  it("long_call_rate uses talk >= 300s", () => {
    const rows = [{ talkTime: 299 }, { talkTime: 300 }];
    expect(ex.execute(q("long_call_rate"), rows).value).toBe(50);
  });

  it("abandonment_rate and answer_rate", () => {
    expect(ex.execute(q("abandonment_rate"), mixedAgents).value).toBe(33.33);
    expect(ex.execute(q("answer_rate"), mixedAgents).value).toBe(66.67);
  });

  it("dateRange filters rows by dateTime", () => {
    const query = q("total_calls", {
      filters: {
        agentName: null,
        queue: null,
        dateRange: { from: "2026-04-01T00:00:00.000Z", to: "2026-04-01T23:59:59.999Z" },
        hour: null,
      },
    });
    expect(ex.execute(query, mixedAgents).value).toBe(2);
  });
});

describe("QueryExecutor — rankings & per-segment", () => {
  const ex = new QueryExecutor("UTC");

  it("top_n_agents_by_total_talk_time orders by sum talk descending", () => {
    const r = ex.execute(q("top_n_agents_by_total_talk_time"), mixedAgents);
    expect(Array.isArray(r.value)).toBe(true);
    const v = r.value as { key: string; value: number }[];
    expect(v[0]).toEqual({ key: "B", value: 200 });
    expect(v[1]).toEqual({ key: "A", value: 150 });
  });

  it("calls_by_agent includes unknown bucket for missing agentName", () => {
    const rows = [
      { agentName: undefined, talkTime: 1 },
      { agentName: "Z", talkTime: 1 },
    ];
    const r = ex.execute(q("calls_by_agent"), rows);
    const v = r.value as { key: string; value: number }[];
    expect(v.find((x) => x.key === "unknown")?.value).toBe(1);
  });

  it("avg_wait_by_agent excludes rows without agentName", () => {
    const rows = [
      { agentName: "A", waitTime: 10 },
      { agentName: undefined, waitTime: 99 },
    ];
    const r = ex.execute(q("avg_wait_by_agent"), rows);
    const v = r.value as { key: string; value: number }[];
    expect(v).toEqual([{ key: "A", value: 10 }]);
  });
});

describe("QueryExecutor — caller & B6/B7/B8", () => {
  const ex = new QueryExecutor("UTC");

  it("repeat_callers_count and top_callers need callerPhone", () => {
    expect(ex.execute(q("repeat_callers_count"), mixedAgents).dataUnavailable).toBe(true);
  });

  it("repeat_callers_count counts distinct phones with >=2 calls", () => {
    const rows = [
      { callerPhone: "111", talkTime: 1 },
      { callerPhone: "111", talkTime: 1 },
      { callerPhone: "222", talkTime: 1 },
    ];
    expect(ex.execute(q("repeat_callers_count"), rows).value).toBe(1);
  });

  it("never_answered_repeat_callers excludes mixed answered+abandoned", () => {
    const rows = [
      { callerPhone: "111", disposition: "abandoned" },
      { callerPhone: "111", disposition: "answered" },
    ];
    const r = ex.execute(q("never_answered_repeat_callers"), rows);
    const v = r.value as { key: string; value: number }[];
    expect(v.find((x) => x.key === "distinct_never_answered_repeat_callers")?.value).toBe(0);
  });

  it("quick_call_red_flag_by_agent flags high short-call share with volume floor", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      agentName: "Risk",
      talkTime: i < 5 ? 10 : 200,
      disposition: "answered",
    }));
    const r = ex.execute(q("quick_call_red_flag_by_agent"), rows);
    const v = r.value as { key: string; value: number }[];
    expect(v.length).toBeGreaterThan(0);
  });

  it("trainee_vs_tenured_compare returns dataUnavailable without labels", () => {
    const r = ex.execute(q("trainee_vs_tenured_compare"), mixedAgents);
    expect(r.dataUnavailable).toBe(true);
  });

  it("trainee_vs_tenured_compare splits on customTag", () => {
    const rows = [
      { agentName: "T1", talkTime: 60, customTag: "trainee" },
      { agentName: "T2", talkTime: 120, customTag: "tenured" },
    ];
    const r = ex.execute(q("trainee_vs_tenured_compare"), rows);
    expect(r.dataUnavailable).toBeFalsy();
    const v = r.value as { key: string; value: number }[];
    expect(v.find((x) => x.key === "trainee — calls")?.value).toBe(1);
  });
});

describe("QueryExecutor — transfer_rate dataUnavailable without disposition", () => {
  const ex = new QueryExecutor("UTC");

  it("marks dataUnavailable when no disposition on rows", () => {
    const rows = [{ talkTime: 1 }, { talkTime: 1 }];
    const r = ex.execute(q("transfer_rate"), rows);
    expect(r.dataUnavailable).toBe(true);
    expect(r.value).toBe(0);
  });
});
