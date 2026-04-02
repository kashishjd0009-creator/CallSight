import { describe, expect, it } from "vitest";

import { userMessageFromApiError } from "./map-api-error.js";

describe("userMessageFromApiError", () => {
  it("ignores raw vendor-like message and maps AI_RATE_LIMIT by code", () => {
    const msg = userMessageFromApiError(
      429,
      {
        code: "AI_RATE_LIMIT",
        message:
          "[GoogleGenerativeAI Error]: [429 Too Many Requests] quotaId GenerateRequestsPerDay",
      },
      "fallback",
    );
    expect(msg.toLowerCase()).not.toContain("google");
    expect(msg.toLowerCase()).not.toContain("quota");
    expect(msg).toMatch(/busy|wait|minute/i);
  });

  it("returns generic text for 5xx regardless of message", () => {
    expect(
      userMessageFromApiError(
        500,
        { code: "INTERNAL_SERVER_ERROR", message: "Invalid `prisma` invocation secret" },
        "x",
      ),
    ).toBe("Something went wrong. Please try again later.");
  });

  it("returns generic text for status 0 (network)", () => {
    expect(userMessageFromApiError(0, { code: "AI_RATE_LIMIT" }, "fallback")).toBe(
      "Something went wrong. Please try again later.",
    );
  });

  it("uses fallback when code is unknown", () => {
    expect(userMessageFromApiError(418, { code: "TEAPOT", message: "no" }, "Custom fallback")).toBe(
      "Custom fallback",
    );
  });

  it("maps known codes for 4xx", () => {
    expect(userMessageFromApiError(401, { code: "UNAUTHORIZED" }, "f")).toMatch(/sign in/i);
    expect(userMessageFromApiError(422, { code: "VALIDATION_ERROR" }, "f")).toMatch(/validate/i);
  });

  it("maps INVALID_CREDENTIALS on login to fixed copy (not generic 500)", () => {
    expect(
      userMessageFromApiError(401, { code: "INVALID_CREDENTIALS", message: "secret" }, "f"),
    ).toBe("Invalid credentials!");
  });
});
