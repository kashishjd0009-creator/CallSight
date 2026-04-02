import type { CanonicalCallRecord } from "../analytics/analytics.types.js";
import { getHourInTimeZone } from "../analytics/reporting-timezone.js";
import type { ParsedQuery } from "./query.types.js";

export function applyDateRange(
  record: CanonicalCallRecord,
  fromIso: string | null,
  toIso: string | null,
): boolean {
  if (!fromIso && !toIso) {
    return true;
  }
  if (!record.dateTime) {
    return false;
  }
  const t = record.dateTime.getTime();
  if (fromIso) {
    const from = Date.parse(fromIso);
    if (Number.isFinite(from) && t < from) {
      return false;
    }
  }
  if (toIso) {
    const to = Date.parse(toIso);
    if (Number.isFinite(to) && t > to) {
      return false;
    }
  }
  return true;
}

export function filterRecordsForQuery(
  query: ParsedQuery,
  records: CanonicalCallRecord[],
  resolvedAgent: string | null,
  reportingTimeZone: string,
): CanonicalCallRecord[] {
  return records.filter((record) => {
    if (query.filters.agentName && resolvedAgent) {
      if ((record.agentName ?? "").toLowerCase() !== resolvedAgent.toLowerCase()) {
        return false;
      }
    }
    if (query.filters.agentName && !resolvedAgent) {
      return false;
    }
    if (
      query.filters.queue &&
      (record.queue ?? "").toLowerCase() !== query.filters.queue.toLowerCase()
    ) {
      return false;
    }
    if (query.filters.hour !== null) {
      const hour =
        record.dateTime === undefined
          ? undefined
          : getHourInTimeZone(record.dateTime, reportingTimeZone);
      if (hour !== query.filters.hour) {
        return false;
      }
    }
    if (!applyDateRange(record, query.filters.dateRange.from, query.filters.dateRange.to)) {
      return false;
    }
    return true;
  });
}
