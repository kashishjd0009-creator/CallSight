import { describe, expect, it } from "vitest";

import { buildAgentLeaderboardQueryString } from "./agent-leaderboard-query.js";

describe("buildAgentLeaderboardQueryString", () => {
  it("appends sortBy and order to empty analytics string", () => {
    const qs = buildAgentLeaderboardQueryString("", "calls", "desc");
    expect(qs).toBe("sortBy=calls&order=desc");
  });

  it("preserves existing filter params and sets sort", () => {
    const qs = buildAgentLeaderboardQueryString(
      "queue=Sales&hourFrom=9&hourTo=17",
      "avgWait",
      "asc",
    );
    const p = new URLSearchParams(qs);
    expect(p.get("queue")).toBe("Sales");
    expect(p.get("hourFrom")).toBe("9");
    expect(p.get("hourTo")).toBe("17");
    expect(p.get("sortBy")).toBe("avgWait");
    expect(p.get("order")).toBe("asc");
  });

  it("overwrites previous sort params", () => {
    const qs = buildAgentLeaderboardQueryString("sortBy=calls&order=desc", "sharePct", "asc");
    const p = new URLSearchParams(qs);
    expect(p.get("sortBy")).toBe("sharePct");
    expect(p.get("order")).toBe("asc");
  });
});
