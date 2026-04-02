import { z } from "zod";

import { COMPARE_MEASURES } from "./compare-metrics.js";

export const dashboardQuerySchema = z.object({
  uploadId: z.string().uuid(),
});

const measureEnum = COMPARE_MEASURES as unknown as [string, ...string[]];

const legacyCompareBodySchema = z.object({
  dimension: z.enum(["agent", "queue"]),
  names: z.array(z.string().min(1)).min(2).max(50),
  measure: z.enum(measureEnum),
});

const scalarCompareBodySchema = z.object({
  mode: z.literal("scalar"),
  dimension: z.enum(["agent", "queue"]),
  names: z.array(z.string().min(1)).min(2).max(50),
  measure: z.enum(measureEnum),
});

const timeSeriesCompareBodySchema = z.object({
  mode: z.literal("time_series"),
  dimension: z.enum(["agent", "queue"]),
  names: z.array(z.string().min(1)).min(2).max(50),
  column: z.enum(["talkTime", "waitTime", "holdTime", "wrapUpTime"]),
  bucket: z.enum(["hour", "day"]),
});

/** Legacy `{ dimension, names, measure }` is treated as `mode: "scalar"`. */
export const analyticsCompareBodySchema = z.union([
  scalarCompareBodySchema,
  timeSeriesCompareBodySchema,
  legacyCompareBodySchema.transform((d) => ({ mode: "scalar" as const, ...d })),
]);
