import { describe, expect, it } from "vitest";

import { parsedQuerySchema } from "../ai-query.validators.js";

describe("parsedQuerySchema", () => {
  it("accepts parameters.n null (Gemini often returns this for scalar metrics)", () => {
    const raw = {
      metric: "aht",
      filters: {
        agentName: "ethan",
        queue: null,
        dateRange: { from: null, to: null },
        hour: null,
      },
      parameters: { n: null },
      visualizationType: "number" as const,
      naturalLanguageDescription: "AHT for Ethan",
    };
    const out = parsedQuerySchema.safeParse(raw);
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.data.metric).toBe("aht");
      expect(out.data.filters.agentName).toBe("ethan");
      expect(out.data.parameters.n).toBe(5);
    }
  });
});
