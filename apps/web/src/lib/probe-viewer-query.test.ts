import { describe, expect, it } from "vitest";

import { buildProbeViewerQuery } from "./probe-viewer-query.js";

describe("buildProbeViewerQuery", () => {
  it("uses default pagination and newest sort", () => {
    expect(buildProbeViewerQuery({})).toBe("page=1&pageSize=25&sortDir=desc");
  });

  it("includes trimmed search and step filter when set", () => {
    expect(buildProbeViewerQuery({ search: "  abc ", step: " AI_GEMINI_PARSE " })).toBe(
      "page=1&pageSize=25&sortDir=desc&search=abc&step=AI_GEMINI_PARSE",
    );
  });
});
