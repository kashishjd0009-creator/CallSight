/**
 * Builds query string for `GET /api/v1/analytics/:uploadId/agents` with the same
 * filter params as the dashboard plus `sortBy` and `order`.
 */
export function buildAgentLeaderboardQueryString(
  analyticsQueryString: string,
  sortBy: string,
  order: "asc" | "desc",
): string {
  const p = new URLSearchParams(analyticsQueryString);
  p.set("sortBy", sortBy);
  p.set("order", order);
  return p.toString();
}

export const LEADERBOARD_SORT_COLUMNS: { id: string; label: string }[] = [
  { id: "calls", label: "Calls" },
  { id: "agentName", label: "Agent name" },
  { id: "totalTalk", label: "Total talk (s)" },
  { id: "avgTalk", label: "Avg talk (s)" },
  { id: "avgWait", label: "Avg wait (s)" },
  { id: "extraLongCalls", label: "5m+ calls" },
  { id: "shortCalls", label: "Quick <30s" },
  { id: "sharePct", label: "Share %" },
];
