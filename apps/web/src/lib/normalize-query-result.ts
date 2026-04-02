export type QueryVisualization = "number" | "bar" | "line" | "pie" | "table";

export type QueryResultForRender = {
  value: number | Array<{ key: string; value: number }>;
  visualizationType: QueryVisualization;
  naturalLanguageDescription: string;
};

/**
 * Frontend defense-in-depth: keep value shape and visualizationType compatible.
 */
export function normalizeQueryResultForRender(input: QueryResultForRender): QueryResultForRender {
  if (typeof input.value === "number") {
    return { ...input, visualizationType: "number" };
  }

  if (Array.isArray(input.value) && input.visualizationType === "number") {
    return { ...input, visualizationType: "table" };
  }

  return input;
}
