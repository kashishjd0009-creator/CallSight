import { AI_QUERY_USER_MESSAGES } from "./ai-query-user-messages.js";

export type ClassifiedAiQueryParseFailure = {
  httpStatus: number;
  code: string;
  publicMessage: string;
};

/**
 * Maps raw Gemini / SDK / JSON errors to a **client-safe** code + message.
 * Full `Error` must be logged server-side; never pass `error.message` to HTTP JSON.
 */
export function classifyAiQueryParseFailure(error: unknown): ClassifiedAiQueryParseFailure {
  if (error instanceof SyntaxError) {
    return {
      httpStatus: 422,
      code: "PARSE_ERROR",
      publicMessage: AI_QUERY_USER_MESSAGES.parseFailed,
    };
  }

  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    lower.includes("resource exhausted") ||
    lower.includes("rate limit")
  ) {
    return {
      httpStatus: 429,
      code: "AI_RATE_LIMIT",
      publicMessage: AI_QUERY_USER_MESSAGES.rateLimited,
    };
  }

  if (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("socket")
  ) {
    return {
      httpStatus: 503,
      code: "AI_SERVICE_UNAVAILABLE",
      publicMessage: AI_QUERY_USER_MESSAGES.serviceUnavailable,
    };
  }

  if (
    lower.includes("google") ||
    lower.includes("generativelanguage") ||
    lower.includes("generative") ||
    lower.includes("gemini")
  ) {
    return {
      httpStatus: 503,
      code: "AI_SERVICE_ERROR",
      publicMessage: AI_QUERY_USER_MESSAGES.serviceError,
    };
  }

  return {
    httpStatus: 422,
    code: "PARSE_ERROR",
    publicMessage: AI_QUERY_USER_MESSAGES.parseFailed,
  };
}
