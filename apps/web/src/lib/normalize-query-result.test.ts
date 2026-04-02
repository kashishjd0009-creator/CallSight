import { describe, expect, it } from "vitest";

import { normalizeQueryResultForRender } from "./normalize-query-result.js";

describe("normalizeQueryResultForRender", () => {
  it("forces scalar values to number visualization", () => {
    const out = normalizeQueryResultForRender({
      value: 15,
      visualizationType: "line",
      naturalLanguageDescription: "x",
    });
    expect(out.visualizationType).toBe("number");
    expect(out.value).toBe(15);
  });

  it("maps array+number mismatch to table", () => {
    const out = normalizeQueryResultForRender({
      value: [{ key: "Justin", value: 12 }],
      visualizationType: "number",
      naturalLanguageDescription: "x",
    });
    expect(out.visualizationType).toBe("table");
  });

  it("keeps compatible shapes unchanged", () => {
    const out = normalizeQueryResultForRender({
      value: [{ key: "Justin", value: 12 }],
      visualizationType: "pie",
      naturalLanguageDescription: "x",
    });
    expect(out.visualizationType).toBe("pie");
  });
});
