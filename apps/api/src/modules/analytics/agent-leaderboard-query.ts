import type { Request } from "express";
import { z } from "zod";

import { AGENT_LEADERBOARD_SORT_KEYS } from "./agent-performance-sort.js";
import type { AgentLeaderboardSortKey } from "./agent-performance-sort.js";

const sortKeySchema = z.enum(AGENT_LEADERBOARD_SORT_KEYS);

const agentLeaderboardSortQuerySchema = z
  .object({
    sortBy: sortKeySchema.optional(),
    order: z.enum(["asc", "desc"]).optional(),
  })
  .transform((v) => ({
    sortBy: (v.sortBy ?? "calls") as AgentLeaderboardSortKey,
    order: v.order ?? ("desc" as const),
  }));

function firstQueryString(query: Request["query"], key: string): string | undefined {
  const v = query[key];
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v) && typeof v[0] === "string") {
    return v[0];
  }
  return undefined;
}

export type ParsedAgentLeaderboardSort = {
  sortBy: AgentLeaderboardSortKey;
  order: "asc" | "desc";
};

/**
 * Parse `sortBy` + `order` from the request query. Returns `null` if values are invalid.
 */
export function parseAgentLeaderboardSort(
  query: Request["query"],
): ParsedAgentLeaderboardSort | null {
  const raw = {
    sortBy: firstQueryString(query, "sortBy"),
    order: firstQueryString(query, "order"),
  };
  const parsed = agentLeaderboardSortQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}
