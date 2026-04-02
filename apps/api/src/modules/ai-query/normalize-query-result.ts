import type { QueryResult } from "./query-executor.js";

/**
 * Ensures response visualization type matches runtime value shape.
 * Prevents blank UI states when parser emits mismatched visualizationType.
 */
export function normalizeQueryResultForClient(result: QueryResult): QueryResult {
  if (typeof result.value === "number") {
    return { ...result, visualizationType: "number" };
  }

  if (Array.isArray(result.value) && result.visualizationType === "number") {
    return { ...result, visualizationType: "table" };
  }

  return result;
}
