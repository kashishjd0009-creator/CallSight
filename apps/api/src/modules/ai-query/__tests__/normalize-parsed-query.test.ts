import { describe, expect, it } from "vitest";

import { normalizeParsedQueryForExecution } from "../normalize-parsed-query.js";
import type { ParsedQuery } from "../query.types.js";

function base(metric: ParsedQuery["metric"], agentName: string | null): ParsedQuery {
  return {
    metric,
    filters: { agentName, queue: null, dateRange: { from: null, to: null }, hour: null },
    parameters: { n: 5 },
    visualizationType: "number",
    naturalLanguageDescription: "test",
  };
}

describe("normalizeParsedQueryForExecution", () => {
  it("maps avg_wait_by_agent to avg_wait_time when single agent is requested", () => {
    const q = base("avg_wait_by_agent", "Justin");
    expect(normalizeParsedQueryForExecution(q).metric).toBe("avg_wait_time");
  });

  it("maps avg_talk_by_agent to avg_talk_time when single agent is requested", () => {
    const q = base("avg_talk_by_agent", "Justin");
    expect(normalizeParsedQueryForExecution(q).metric).toBe("avg_talk_time");
  });

  it("maps calls_by_agent to total_calls when single agent is requested", () => {
    const q = base("calls_by_agent", "Justin");
    expect(normalizeParsedQueryForExecution(q).metric).toBe("total_calls");
  });

  it("keeps grouped metrics unchanged when no agent filter exists", () => {
    const q = base("avg_wait_by_agent", null);
    expect(normalizeParsedQueryForExecution(q).metric).toBe("avg_wait_by_agent");
  });
});
