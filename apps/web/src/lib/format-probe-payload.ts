/**
 * Gemini/DB sometimes store nested JSON as a string; unwrap so we render objects, not escaped quotes.
 */
export function deepUnwrapJsonStrings(value: unknown, depth = 0): unknown {
  if (depth > 10) {
    return value;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        const parsed: unknown = JSON.parse(value) as unknown;
        return deepUnwrapJsonStrings(parsed, depth + 1);
      } catch {
        return value;
      }
    }
    return value;
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => [k, deepUnwrapJsonStrings(v, depth + 1)]),
    );
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepUnwrapJsonStrings(v, depth + 1));
  }
  return value;
}
