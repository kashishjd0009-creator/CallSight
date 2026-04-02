import { describe, expect, it } from "vitest";

import { deepUnwrapJsonStrings } from "./format-probe-payload.js";

describe("deepUnwrapJsonStrings", () => {
  it("parses JSON object strings into objects", () => {
    const raw = JSON.stringify({
      metric: "total_talk_time",
      filters: { agentName: "Amber", queue: null },
    });
    const out = deepUnwrapJsonStrings(raw);
    expect(out).toEqual({
      metric: "total_talk_time",
      filters: { agentName: "Amber", queue: null },
    });
  });

  it("unwraps nested JSON strings", () => {
    const inner = JSON.stringify({ a: 1 });
    const outer = JSON.stringify({ payload: inner });
    expect(deepUnwrapJsonStrings(outer)).toEqual({ payload: { a: 1 } });
  });

  it("does not treat a plain English sentence in quotes as JSON", () => {
    expect(deepUnwrapJsonStrings('"hello world"')).toBe('"hello world"');
  });
});
