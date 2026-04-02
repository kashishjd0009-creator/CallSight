import { describe, expect, it, vi, beforeEach } from "vitest";

import { PipelineStep } from "../../observability/pipeline-steps.js";

const generateContent = vi.fn();

vi.mock("../gemini.client.js", () => ({
  createGeminiModel: () => ({ generateContent }),
}));

import { parseNaturalLanguageToQuery } from "../query-parser.gemini.js";

const validParsedJson = JSON.stringify({
  metric: "total_calls",
  filters: {
    agentName: null,
    queue: null,
    dateRange: { from: null, to: null },
    hour: null,
  },
  parameters: { n: 5 },
  visualizationType: "number",
  naturalLanguageDescription: "test",
});

describe("parseNaturalLanguageToQuery observability", () => {
  beforeEach(() => {
    generateContent.mockReset();
    generateContent.mockResolvedValue({
      response: {
        text: () => validParsedJson,
      },
    });
  });

  it("uses the same probeSpanId on AI_GEMINI_PARSE before and after", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const observability = { record } as never;

    await parseNaturalLanguageToQuery("test-api-key", "How many calls?", {
      observability,
      ctx: {
        correlationId: "cid-gemini",
        userId: "u1",
        uploadId: "up1",
        httpMethod: "POST",
        httpPath: "/api/v1/query/x",
      },
      systemPromptVersion: "v1",
    });

    const before = record.mock.calls.find(
      (c) =>
        (c[0] as { step?: string; phase?: string }).step === PipelineStep.AI_GEMINI_PARSE &&
        (c[0] as { phase?: string }).phase === "before",
    )?.[0] as { probeSpanId?: string };
    const after = record.mock.calls.find(
      (c) =>
        (c[0] as { step?: string; phase?: string }).step === PipelineStep.AI_GEMINI_PARSE &&
        (c[0] as { phase?: string }).phase === "after",
    )?.[0] as { probeSpanId?: string };

    expect(before?.probeSpanId).toBeTruthy();
    expect(before?.probeSpanId).toBe(after?.probeSpanId);
  });
});
