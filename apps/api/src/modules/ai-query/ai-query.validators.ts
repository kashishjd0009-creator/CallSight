import { z } from "zod";

import { SUPPORTED_METRICS } from "./query.types.js";

export const queryInputSchema = z.object({
  query: z.string().min(1),
});

const metricEnum = SUPPORTED_METRICS as unknown as [string, ...string[]];

function normalizeHour(v: unknown): number | null {
  if (v === null || v === undefined) {
    return null;
  }
  const n = typeof v === "string" ? Number.parseInt(v, 10) : typeof v === "number" ? v : Number.NaN;
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.max(0, Math.min(23, Math.floor(n)));
}

export const parsedQuerySchema = z
  .object({
    metric: z.enum(metricEnum),
    filters: z.object({
      agentName: z.string().nullable().optional(),
      queue: z.string().nullable().optional(),
      dateRange: z
        .object({ from: z.string().nullable().optional(), to: z.string().nullable().optional() })
        .optional(),
      hour: z.unknown().optional().nullable(),
    }),
    // Gemini often emits `"n": null` for “no top‑N”; z.number().optional() rejects null.
    parameters: z.object({ n: z.number().nullable().optional() }).optional(),
    visualizationType: z.enum(["number", "bar", "line", "pie", "table"]),
    naturalLanguageDescription: z.string(),
  })
  .transform((data) => {
    const dr = data.filters.dateRange ?? { from: null, to: null };
    return {
      metric: data.metric,
      filters: {
        agentName: data.filters.agentName ?? null,
        queue: data.filters.queue ?? null,
        dateRange: { from: dr.from ?? null, to: dr.to ?? null },
        hour: normalizeHour(data.filters.hour),
      },
      parameters: {
        n:
          data.parameters?.n != null &&
          typeof data.parameters.n === "number" &&
          data.parameters.n > 0
            ? data.parameters.n
            : 5,
      },
      visualizationType: data.visualizationType,
      naturalLanguageDescription: data.naturalLanguageDescription,
    };
  });
