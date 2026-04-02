import type { ParsedQuery } from "./query.types.js";

/**
 * Post-parse guardrails for common Gemini intent drift.
 * If one specific agent is requested, grouped "*_by_agent" metrics are
 * normalized to scalar equivalents for single-number answers.
 */
export function normalizeParsedQueryForExecution(parsed: ParsedQuery): ParsedQuery {
  if (!parsed.filters.agentName) {
    return parsed;
  }

  if (parsed.metric === "avg_wait_by_agent") {
    return { ...parsed, metric: "avg_wait_time" };
  }
  if (parsed.metric === "avg_talk_by_agent") {
    return { ...parsed, metric: "avg_talk_time" };
  }
  if (parsed.metric === "calls_by_agent") {
    return { ...parsed, metric: "total_calls" };
  }

  return parsed;
}
