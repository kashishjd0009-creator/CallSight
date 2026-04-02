/** User-facing copy for AI query route — never include vendor URLs, quota IDs, or raw SDK text. */
export const AI_QUERY_USER_MESSAGES = {
  parseFailed:
    "We couldn't interpret that question. Try rephrasing or asking about a supported metric.",
  rateLimited: "The AI service is busy right now. Please wait a minute and try again.",
  serviceUnavailable: "We couldn't reach the AI service. Try again in a few moments.",
  serviceError: "The AI service returned an error. Please try again later.",
  schemaInvalid: "The query could not be validated. Try a simpler question.",
  unsupported: "That question can't be answered from your call data with the current metrics.",
} as const;
