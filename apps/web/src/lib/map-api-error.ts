/**
 * Maps API `error.code` to fixed user-facing copy. Does **not** trust `error.message`
 * (defense in depth against vendor/SDK text reaching the UI).
 */
export type ApiErrorPayload = {
  code?: string;
  message?: string;
};

const GENERIC_SERVER = "Something went wrong. Please try again later.";

const USER_MESSAGE_BY_CODE: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid credentials!",
  UNAUTHORIZED: "You need to sign in again.",
  VALIDATION_ERROR: "We couldn't validate that request. Check your input and try again.",
  NOT_FOUND: "We couldn't find that resource.",
  UNSUPPORTED_QUERY:
    "That question can't be answered from your call data with the current metrics.",
  PARSE_ERROR:
    "We couldn't interpret that question. Try rephrasing or asking about a supported metric.",
  QUERY_LIMIT_REACHED: "You've reached your monthly AI query limit. Upgrade to run more queries.",
  AI_RATE_LIMIT: "The AI service is busy right now. Please wait a minute and try again.",
  AI_SERVICE_UNAVAILABLE: "We couldn't reach the AI service. Try again in a few moments.",
  AI_SERVICE_ERROR: "The AI service returned an error. Please try again later.",
  INVALID_CURRENT_PASSWORD: "Current password is incorrect.",
  INTERNAL_SERVER_ERROR: GENERIC_SERVER,
};

export function userMessageFromApiError(
  status: number,
  error: ApiErrorPayload | undefined,
  fallback: string,
): string {
  if (!Number.isFinite(status) || status === 0 || status >= 500) {
    return GENERIC_SERVER;
  }
  const code = error?.code;
  if (code && Object.prototype.hasOwnProperty.call(USER_MESSAGE_BY_CODE, code)) {
    return USER_MESSAGE_BY_CODE[code]!;
  }
  return fallback;
}
