import type { CanonicalCallRecord } from "./analytics.types.js";
import { isTransferDisposition, normalizeDisposition } from "./disposition-utils.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function handleSeconds(r: CanonicalCallRecord): number {
  return (r.talkTime ?? 0) + (r.holdTime ?? 0) + (r.wrapUpTime ?? 0);
}

/** B7 — must match query-executor constants */
export const QUICK_CALL_THRESHOLD_SEC = 30;
export const QUICK_CALL_RED_FLAG_RATE_PCT = 40;
export const QUICK_CALL_MIN_AGENT_CALLS = 10;
export const LONG_CALL_THRESHOLD_SEC = 300;

export const COMPARE_MEASURES = [
  "total_calls",
  "total_talk_time",
  "total_wait_time",
  "avg_talk_time",
  "avg_wait_time",
  "aht",
  "service_level_pct",
  "short_call_rate",
  "long_call_rate",
  "abandonment_rate",
  "answer_rate",
  "transfer_rate",
] as const;

export type CompareMeasure = (typeof COMPARE_MEASURES)[number];

export const COMPARE_MEASURE_LABELS: Record<CompareMeasure, string> = {
  total_calls: "Total calls",
  total_talk_time: "Total talk time (s)",
  total_wait_time: "Total wait time (s)",
  avg_talk_time: "Avg talk time (s)",
  avg_wait_time: "Avg wait time (s)",
  aht: "AHT (s) — talk+hold+wrap",
  service_level_pct: "Service level % (wait ≤20s)",
  short_call_rate: "Short-call rate % (<30s talk)",
  long_call_rate: "Long-call rate % (≥300s talk)",
  abandonment_rate: "Abandonment rate %",
  answer_rate: "Answer rate %",
  transfer_rate: "Transfer rate % (disposition match)",
};

/** total_calls is integer count — discrete; others continuous for chart picker. */
export const COMPARE_MEASURE_KIND: Record<CompareMeasure, "continuous" | "discrete"> = {
  total_calls: "discrete",
  total_talk_time: "continuous",
  total_wait_time: "continuous",
  avg_talk_time: "continuous",
  avg_wait_time: "continuous",
  aht: "continuous",
  service_level_pct: "continuous",
  short_call_rate: "continuous",
  long_call_rate: "continuous",
  abandonment_rate: "continuous",
  answer_rate: "continuous",
  transfer_rate: "continuous",
};

function computeMeasureOnSlice(records: CanonicalCallRecord[], measure: CompareMeasure): number {
  const n = records.length;
  switch (measure) {
    case "total_calls":
      return n;
    case "total_talk_time":
      return records.reduce((s, r) => s + (r.talkTime ?? 0), 0);
    case "total_wait_time":
      return records.reduce((s, r) => s + (r.waitTime ?? 0), 0);
    case "avg_talk_time":
      return n > 0 ? round2(records.reduce((s, r) => s + (r.talkTime ?? 0), 0) / n) : 0;
    case "avg_wait_time":
      return n > 0 ? round2(records.reduce((s, r) => s + (r.waitTime ?? 0), 0) / n) : 0;
    case "aht": {
      if (n === 0) {
        return 0;
      }
      const sum = records.reduce((s, r) => s + handleSeconds(r), 0);
      return round2(sum / n);
    }
    case "service_level_pct":
      return n > 0
        ? round2(
            (records.filter((r) => (r.waitTime ?? Number.MAX_SAFE_INTEGER) <= 20).length / n) * 100,
          )
        : 0;
    case "short_call_rate":
      return n > 0
        ? round2(
            (records.filter((r) => (r.talkTime ?? 0) < QUICK_CALL_THRESHOLD_SEC).length / n) * 100,
          )
        : 0;
    case "long_call_rate":
      return n > 0
        ? round2(
            (records.filter((r) => (r.talkTime ?? 0) >= LONG_CALL_THRESHOLD_SEC).length / n) * 100,
          )
        : 0;
    case "abandonment_rate":
      return n > 0
        ? round2(
            (records.filter((r) => normalizeDisposition(r.disposition) === "abandoned").length /
              n) *
              100,
          )
        : 0;
    case "answer_rate":
      return n > 0
        ? round2(
            (records.filter((r) => normalizeDisposition(r.disposition) === "answered").length / n) *
              100,
          )
        : 0;
    case "transfer_rate":
      return n > 0
        ? round2((records.filter((r) => isTransferDisposition(r.disposition)).length / n) * 100)
        : 0;
  }
}

export type ScalarCompareResult = {
  mode: "scalar";
  /** One bar per entity; catalog measures are single aggregated values per agent/queue. */
  chartHint: "bar";
  measure: CompareMeasure;
  measureLabel: string;
  points: { name: string; value: number }[];
};

export function compareByDimension(
  records: CanonicalCallRecord[],
  dimension: "agent" | "queue",
  names: string[],
  measure: CompareMeasure,
  reportingTimeZone: string,
): ScalarCompareResult {
  void reportingTimeZone;
  const measureLabel = COMPARE_MEASURE_LABELS[measure];
  const measureKind = COMPARE_MEASURE_KIND[measure];
  const points = names.map((rawName) => {
    const name = rawName.trim();
    const slice = records.filter((r) => {
      if (dimension === "agent") {
        return (r.agentName ?? "").trim() === name;
      }
      return (r.queue ?? "").trim() === name;
    });
    const value = computeMeasureOnSlice(slice, measure);
    return { name, value: measureKind === "discrete" ? Math.round(value) : value };
  });
  return { mode: "scalar", chartHint: "bar", measure, measureLabel, points };
}
