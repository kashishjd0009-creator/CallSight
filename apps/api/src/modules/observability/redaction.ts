const SENSITIVE_KEYS = new Set(
  [
    "password",
    "currentPassword",
    "newPassword",
    "accessToken",
    "refreshToken",
    "authorization",
    "csvContent",
    "token",
    "passwordHash",
    "SMTP_PASS",
    "jwtSecret",
  ].map((k) => k.toLowerCase()),
);

const MAX_STRING = 500;

/** Keys whose string values must not be truncated (Gemini probe full text). */
export const GEMINI_PROBE_FULL_TEXT_KEYS = new Set([
  "userQuery",
  "dataSchemaPrompt",
  "rawModelOutput",
]);

function truncateString(s: string): string {
  if (s.length <= MAX_STRING) {
    return s;
  }
  return `${s.slice(0, MAX_STRING)}…[truncated]`;
}

export function redactPayload(value: unknown, keyHint?: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    if (keyHint && GEMINI_PROBE_FULL_TEXT_KEYS.has(keyHint)) {
      return value;
    }
    return truncateString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPayload(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = redactPayload(v, k);
    }
    return out;
  }
  return "[UNSERIALIZABLE]";
}
