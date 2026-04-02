import { describe, expect, it } from "vitest";

import { normalizeQueryResultForClient } from "../normalize-query-result.js";
import type { QueryResult } from "../query-executor.js";

function base(partial: Partial<QueryResult>): QueryResult {
  return {
    value: 1,
    visualizationType: "number",
    naturalLanguageDescription: "desc",
    ...partial,
  };
}

describe("normalizeQueryResultForClient", () => {
  it("forces scalar values to visualizationType number", () => {
    const out = normalizeQueryResultForClient(base({ value: 42, visualizationType: "bar" }));
    expect(out.visualizationType).toBe("number");
    expect(out.value).toBe(42);
  });

  it("maps array+number mismatch to table", () => {
    const out = normalizeQueryResultForClient(
      base({ value: [{ key: "A", value: 2 }], visualizationType: "number" }),
    );
    expect(Array.isArray(out.value)).toBe(true);
    expect(out.visualizationType).toBe("table");
  });

  it("keeps compatible array visualization unchanged", () => {
    const out = normalizeQueryResultForClient(
      base({ value: [{ key: "A", value: 2 }], visualizationType: "bar" }),
    );
    expect(out.visualizationType).toBe("bar");
  });
});
