import { describe, expect, it } from "vitest";

import { QueryExecutor } from "../query-executor.js";
import type { ParsedQuery } from "../query.types.js";

const records = [
  {
    agentName: "Justin Taylor",
    queue: "Sales",
    talkTime: 120,
    waitTime: 10,
    dateTime: new Date("2026-04-01T09:00:00.000Z"),
  },
  {
    agentName: "Alex Doe",
    queue: "Support",
    talkTime: 60,
    waitTime: 20,
    dateTime: new Date("2026-04-01T10:00:00.000Z"),
  },
  {
    agentName: "Justin Taylor",
    queue: "Sales",
    talkTime: 180,
    waitTime: 15,
    dateTime: new Date("2026-04-01T09:30:00.000Z"),
  },
];

function baseQuery(metric: ParsedQuery["metric"]): ParsedQuery {
  return {
    metric,
    filters: { agentName: null, queue: null, dateRange: { from: null, to: null }, hour: null },
    parameters: { n: 5 },
    visualizationType: "number",
    naturalLanguageDescription: "test",
  };
}

describe("QueryExecutor", () => {
  const executor = new QueryExecutor("UTC");

  it("executes total_calls metric", () => {
    const result = executor.execute(baseQuery("total_calls"), records);
    expect(result.value).toBe(3);
  });

  it("executes avg_talk_time metric", () => {
    const result = executor.execute(baseQuery("avg_talk_time"), records);
    expect(result.value).toBe(120);
  });

  it("fuzzy matches partial agent name using includes", () => {
    const query = baseQuery("total_calls");
    query.filters.agentName = "justin";
    const result = executor.execute(query, records);
    expect(result.value).toBe(2);
    expect(result.resolvedFilters?.agentName).toBe("Justin Taylor");
  });

  it("fuzzy matches agent name by levenshtein fallback", () => {
    const query = baseQuery("total_calls");
    query.filters.agentName = "Jstin Tylor";
    const result = executor.execute(query, records);
    expect(result.value).toBe(2);
    expect(result.resolvedFilters?.agentName).toBe("Justin Taylor");
  });

  it("returns no match when agent cannot be resolved", () => {
    const query = baseQuery("total_calls");
    query.filters.agentName = "Not Existing Agent";
    const result = executor.execute(query, records);
    expect(result.value).toBe(0);
    expect(result.resolvedFilters?.agentName).toBeNull();
  });

  it("hour filter uses reporting time zone", () => {
    const chicagoExec = new QueryExecutor("America/Chicago");
    const narrow = [
      {
        agentName: "Agent",
        queue: "Q",
        talkTime: 60,
        waitTime: 10,
        dateTime: new Date("2026-04-01T07:00:00.000Z"),
      },
    ];
    const q = baseQuery("total_calls");
    q.filters.hour = 2;
    expect(chicagoExec.execute(q, narrow).value).toBe(1);
    expect(executor.execute(q, narrow).value).toBe(0);
  });

  it("scalar metrics force visualizationType number so the chat UI always shows the value (Gemini may send bar/line)", () => {
    const q = baseQuery("avg_wait_time");
    q.visualizationType = "bar";
    const result = executor.execute(q, records);
    expect(typeof result.value).toBe("number");
    expect(result.visualizationType).toBe("number");
  });

  it("aht uses talk+hold+wrap; avg_talk_time is talk-only", () => {
    const withWrap = [
      {
        agentName: "X",
        queue: "Q",
        talkTime: 60,
        holdTime: 10,
        wrapUpTime: 5,
        waitTime: 0,
        dateTime: new Date("2026-04-01T12:00:00.000Z"),
      },
    ];
    const exec = new QueryExecutor("UTC");
    const qAht = baseQuery("aht");
    const qAvg = baseQuery("avg_talk_time");
    expect(exec.execute(qAht, withWrap).value).toBe(75);
    expect(exec.execute(qAvg, withWrap).value).toBe(60);
  });

  it("transfer_rate uses disposition substring transfer", () => {
    const rows = [
      { disposition: "Transferred Out", talkTime: 10 },
      { disposition: "answered", talkTime: 10 },
    ];
    const exec = new QueryExecutor("UTC");
    const q = baseQuery("transfer_rate");
    expect(exec.execute(q, rows).value).toBe(50);
  });

  it("call_distribution_by_hour buckets by reporting time zone", () => {
    const chicagoExec = new QueryExecutor("America/Chicago");
    const q = baseQuery("call_distribution_by_hour");
    q.visualizationType = "bar";
    const narrow = [
      {
        agentName: "Agent",
        queue: "Q",
        talkTime: 60,
        waitTime: 10,
        dateTime: new Date("2026-04-01T07:00:00.000Z"),
      },
    ];
    const rUtc = executor.execute(q, narrow);
    const rChi = chicagoExec.execute(q, narrow);
    expect(rUtc.value).toEqual([{ key: "7", value: 1 }]);
    expect(rChi.value).toEqual([{ key: "2", value: 1 }]);
  });
});
