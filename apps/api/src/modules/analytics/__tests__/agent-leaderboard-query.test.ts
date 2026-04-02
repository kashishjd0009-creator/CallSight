import { describe, expect, it } from "vitest";

import { parseAgentLeaderboardSort } from "../agent-leaderboard-query.js";

describe("parseAgentLeaderboardSort", () => {
  it("defaults to calls desc when params omitted", () => {
    expect(parseAgentLeaderboardSort({})).toEqual({ sortBy: "calls", order: "desc" });
  });

  it("parses valid sortBy and order", () => {
    expect(parseAgentLeaderboardSort({ sortBy: "avgWait", order: "asc" })).toEqual({
      sortBy: "avgWait",
      order: "asc",
    });
  });

  it("rejects invalid sortBy", () => {
    expect(parseAgentLeaderboardSort({ sortBy: "not_a_column" })).toBeNull();
  });

  it("rejects invalid order", () => {
    expect(parseAgentLeaderboardSort({ order: "sideways" })).toBeNull();
  });
});
