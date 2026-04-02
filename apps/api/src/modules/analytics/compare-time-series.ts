import type { CanonicalCallRecord } from "./analytics.types.js";
import { formatDateKeyInTimeZone, getHourInTimeZone } from "./reporting-timezone.js";

export const TIME_SERIES_COLUMNS = ["talkTime", "waitTime", "holdTime", "wrapUpTime"] as const;
export type TimeSeriesColumn = (typeof TIME_SERIES_COLUMNS)[number];

export type TimeSeriesBucket = "hour" | "day";

export type TimeSeriesCompareResult = {
  mode: "time_series";
  chartHint: "line";
  column: TimeSeriesColumn;
  bucket: TimeSeriesBucket;
  series: Array<{
    name: string;
    points: Array<{ bucketKey: string; label: string; value: number }>;
  }>;
};

function getColumnValue(r: CanonicalCallRecord, column: TimeSeriesColumn): number {
  switch (column) {
    case "talkTime":
      return r.talkTime ?? 0;
    case "waitTime":
      return r.waitTime ?? 0;
    case "holdTime":
      return r.holdTime ?? 0;
    case "wrapUpTime":
      return r.wrapUpTime ?? 0;
    default: {
      const _e: never = column;
      return _e;
    }
  }
}

function bucketKeyForRecord(
  record: CanonicalCallRecord,
  bucket: TimeSeriesBucket,
  reportingTimeZone: string,
): string | null {
  if (!record.dateTime) {
    return null;
  }
  if (bucket === "day") {
    return formatDateKeyInTimeZone(record.dateTime, reportingTimeZone);
  }
  const day = formatDateKeyInTimeZone(record.dateTime, reportingTimeZone);
  const h = getHourInTimeZone(record.dateTime, reportingTimeZone);
  return `${day}|${String(h).padStart(2, "0")}`;
}

function shortLabel(bucketKey: string, bucket: TimeSeriesBucket): string {
  return bucket === "day" ? bucketKey : bucketKey.replace("|", " ");
}

export function compareTimeSeriesByDimension(
  records: CanonicalCallRecord[],
  dimension: "agent" | "queue",
  names: string[],
  column: TimeSeriesColumn,
  bucket: TimeSeriesBucket,
  reportingTimeZone: string,
): TimeSeriesCompareResult {
  const series = names.map((rawName) => {
    const name = rawName.trim();
    const slice = records.filter((r) => {
      if (dimension === "agent") {
        return (r.agentName ?? "").trim() === name;
      }
      return (r.queue ?? "").trim() === name;
    });

    const byBucket = new Map<string, number[]>();
    for (const row of slice) {
      const bk = bucketKeyForRecord(row, bucket, reportingTimeZone);
      if (bk === null) {
        continue;
      }
      const v = getColumnValue(row, column);
      const arr = byBucket.get(bk) ?? [];
      arr.push(v);
      byBucket.set(bk, arr);
    }

    const points = Array.from(byBucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucketKey, values]) => {
        const n = values.length;
        const value = n > 0 ? values.reduce((s, x) => s + x, 0) / n : 0;
        const rounded = Math.round(value * 100) / 100;
        return { bucketKey, label: shortLabel(bucketKey, bucket), value: rounded };
      });

    return { name, points };
  });

  return {
    mode: "time_series",
    chartHint: "line",
    column,
    bucket,
    series,
  };
}
