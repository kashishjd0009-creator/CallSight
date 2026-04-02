import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

import { AppError } from "../../../core/errors.js";
import { AiQueryController } from "../ai-query.controller.js";

vi.mock("../query-parser.gemini.js", () => ({
  parseNaturalLanguageToQuery: vi.fn(),
}));

vi.mock("../../uploads/load-upload-records.js", () => ({
  loadCanonicalRecordsForUpload: vi.fn(),
}));

import { parseNaturalLanguageToQuery } from "../query-parser.gemini.js";
import { loadCanonicalRecordsForUpload } from "../../uploads/load-upload-records.js";

describe("AiQueryController query — parse failures", () => {
  const observability = {
    record: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadCanonicalRecordsForUpload).mockResolvedValue({
      records: [],
      columnMap: {},
    });
  });

  function createController() {
    return new AiQueryController(
      {} as never,
      {} as never,
      {} as never,
      "gemini-key",
      {} as never,
      observability as never,
    );
  }

  function mockReq(): Request {
    return {
      auth: { userId: "user-1" },
      params: { uploadId: "upload-1" },
      body: { query: "top agents" },
      correlationId: "corr-1",
      method: "POST",
      originalUrl: "/api/v1/query/upload-1",
    } as unknown as Request;
  }

  it("throws AppError with client-safe message for Gemini 429-style errors (full text only in logs)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(parseNaturalLanguageToQuery).mockRejectedValue(
      new Error(
        "[GoogleGenerativeAI Error]: [429 Too Many Requests] quotaId: GenerateRequestsPerDayPerProjectFreeTier",
      ),
    );

    const controller = createController();
    const err = await controller.query(mockReq(), {} as Response).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    const appErr = err as AppError;
    expect(appErr.code).toBe("AI_RATE_LIMIT");
    expect(appErr.statusCode).toBe(429);
    expect(appErr.message).not.toContain("GoogleGenerativeAI");
    expect(appErr.message).not.toContain("quotaId");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("throws PARSE_ERROR with generic copy for unknown errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(parseNaturalLanguageToQuery).mockRejectedValue(new Error("random internal"));
    const controller = createController();
    try {
      const err = await controller.query(mockReq(), {} as Response).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("PARSE_ERROR");
      expect((err as AppError).message).not.toContain("random");
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
