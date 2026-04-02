import type { DashboardResult } from "./analytics.types.js";

export type AgentPerformanceRow = DashboardResult["charts"]["agentPerformance"][number];

export const AGENT_LEADERBOARD_SORT_KEYS = [
  "agentName",
  "calls",
  "totalTalk",
  "avgTalk",
  "avgWait",
  "sharePct",
  "shortCalls",
  "extraLongCalls",
] as const;

export type AgentLeaderboardSortKey = (typeof AGENT_LEADERBOARD_SORT_KEYS)[number];

function compareByKey(
  a: AgentPerformanceRow,
  b: AgentPerformanceRow,
  sortBy: AgentLeaderboardSortKey,
): number {
  const va = a[sortBy];
  const vb = b[sortBy];
  if (typeof va === "string" && typeof vb === "string") {
    return va.localeCompare(vb, undefined, { sensitivity: "base" });
  }
  if (typeof va === "number" && typeof vb === "number") {
    return va - vb;
  }
  return 0;
}

/**
 * Stable sort: primary by `sortBy` × `order`, tie-break by agent name ascending.
 */
export function sortAgentPerformanceRows(
  rows: AgentPerformanceRow[],
  sortBy: AgentLeaderboardSortKey,
  order: "asc" | "desc",
): AgentPerformanceRow[] {
  const mult = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const primary = compareByKey(a, b, sortBy) * mult;
    if (primary !== 0) {
      return primary;
    }
    return a.agentName.localeCompare(b.agentName, undefined, { sensitivity: "base" });
  });
}
