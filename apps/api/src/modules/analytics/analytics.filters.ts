import type { Request } from "express";

import type { CanonicalCallRecord } from "./analytics.types.js";
import { getHourInTimeZone } from "./reporting-timezone.js";

export type AnalyticsRecordFilters = {
  queue?: string;
  agent?: string;
  disposition?: string;
  minTalkTime?: number;
  hourFrom?: number;
  hourTo?: number;
};

export function parseAnalyticsFilters(query: Request["query"]): AnalyticsRecordFilters {
  const queueRaw = query.queue;
  const agentRaw = query.agent;
  const dispositionRaw = query.disposition;
  const minTalkRaw = query.minTalkTime;
  const queue =
    typeof queueRaw === "string" && queueRaw.trim() !== "" && queueRaw !== "ALL"
      ? queueRaw.trim()
      : undefined;
  const agent =
    typeof agentRaw === "string" && agentRaw.trim() !== "" && agentRaw !== "ALL"
      ? agentRaw.trim()
      : undefined;
  const disposition =
    typeof dispositionRaw === "string" && dispositionRaw.trim() !== "" && dispositionRaw !== "ALL"
      ? dispositionRaw.trim().toLowerCase()
      : undefined;
  const minTalkParsed =
    typeof minTalkRaw === "string" ? Number.parseInt(minTalkRaw, 10) : Number.NaN;
  const minTalkTime =
    Number.isFinite(minTalkParsed) && minTalkParsed > 0 ? minTalkParsed : undefined;

  const hfRaw = query.hourFrom;
  const htRaw = query.hourTo;
  if (typeof hfRaw !== "string" || typeof htRaw !== "string") {
    return { queue, agent, disposition, minTalkTime };
  }

  let hourFrom = Number.parseInt(hfRaw, 10);
  let hourTo = Number.parseInt(htRaw, 10);
  if (!Number.isFinite(hourFrom) || !Number.isFinite(hourTo)) {
    return { queue, agent, disposition, minTalkTime };
  }

  hourFrom = Math.max(0, Math.min(23, hourFrom));
  hourTo = Math.max(0, Math.min(23, hourTo));
  if (hourFrom > hourTo) {
    [hourFrom, hourTo] = [hourTo, hourFrom];
  }
  return { queue, agent, disposition, minTalkTime, hourFrom, hourTo };
}

export function filterCanonicalRecords(
  records: CanonicalCallRecord[],
  filters: AnalyticsRecordFilters,
  reportingTimeZone = "UTC",
): CanonicalCallRecord[] {
  const { queue, agent, disposition, minTalkTime, hourFrom, hourTo } = filters;
  const hourBounded = hourFrom !== undefined && hourTo !== undefined;

  return records.filter((record) => {
    if (queue !== undefined) {
      const rq = record.queue?.trim();
      if (rq !== queue) {
        return false;
      }
    }
    if (agent !== undefined) {
      const ra = record.agentName?.trim();
      if (ra !== agent) {
        return false;
      }
    }
    if (hourBounded) {
      if (!record.dateTime) {
        return false;
      }
      const h = getHourInTimeZone(record.dateTime, reportingTimeZone);
      if (h < hourFrom! || h > hourTo!) {
        return false;
      }
    }
    if (disposition !== undefined) {
      const normalized = record.disposition?.trim().toLowerCase();
      if (normalized !== disposition) {
        return false;
      }
    }
    if (minTalkTime !== undefined) {
      if ((record.talkTime ?? 0) < minTalkTime) {
        return false;
      }
    }
    return true;
  });
}

export function uniqueFieldValues(
  records: CanonicalCallRecord[],
  field: "queue" | "agentName",
): string[] {
  const out = records
    .map((r) => (field === "queue" ? r.queue?.trim() : r.agentName?.trim()))
    .filter((v): v is string => Boolean(v && v.length > 0));
  return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
}
