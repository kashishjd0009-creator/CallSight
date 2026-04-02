import { describe, expect, it } from "vitest";

import { classifyAiQueryParseFailure } from "../classify-ai-query-parse-failure.js";

describe("classifyAiQueryParseFailure", () => {
  it("classifies Gemini 429 quota / Too Many Requests as AI_RATE_LIMIT", () => {
    const long = `[GoogleGenerativeAI Error]: [429 Too Many Requests] You exceeded your current quota`;
    const r = classifyAiQueryParseFailure(new Error(long));
    expect(r.code).toBe("AI_RATE_LIMIT");
    expect(r.httpStatus).toBe(429);
    expect(r.publicMessage).toMatch(/busy|wait|minute/i);
    expect(r.publicMessage).not.toContain("GoogleGenerativeAI");
    expect(r.publicMessage).not.toContain("quotaId");
  });

  it("classifies generic Google API error without 429 as AI_SERVICE_ERROR", () => {
    const r = classifyAiQueryParseFailure(new Error("GoogleGenerativeAI Error: something failed"));
    expect(r.code).toBe("AI_SERVICE_ERROR");
    expect(r.httpStatus).toBe(503);
    expect(r.publicMessage.toLowerCase()).not.toContain("google");
  });

  it("classifies JSON SyntaxError as PARSE_ERROR", () => {
    const r = classifyAiQueryParseFailure(new SyntaxError("Unexpected token"));
    expect(r.code).toBe("PARSE_ERROR");
    expect(r.httpStatus).toBe(422);
  });

  it("classifies unknown errors as PARSE_ERROR with generic message", () => {
    const r = classifyAiQueryParseFailure(new Error("random"));
    expect(r.code).toBe("PARSE_ERROR");
    expect(r.httpStatus).toBe(422);
    expect(r.publicMessage).not.toContain("random");
  });
});
