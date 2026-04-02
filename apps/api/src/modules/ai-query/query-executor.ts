import { closest, distance } from "fastest-levenshtein";

import type { CanonicalCallRecord } from "../analytics/analytics.types.js";
import {
  isAnsweredDisposition,
  isTransferDisposition,
  normalizeDisposition,
} from "../analytics/disposition-utils.js";
import {
  LONG_CALL_THRESHOLD_SEC,
  QUICK_CALL_MIN_AGENT_CALLS,
  QUICK_CALL_RED_FLAG_RATE_PCT,
  QUICK_CALL_THRESHOLD_SEC,
} from "../analytics/compare-metrics.js";
import { formatDateKeyInTimeZone, getHourInTimeZone } from "../analytics/reporting-timezone.js";
import { filterRecordsForQuery } from "./query-executor.filters.js";
import type { ParsedQuery } from "./query.types.js";

export interface QueryResult {
  value: number | Array<{ key: string; value: number }>;
  visualizationType: ParsedQuery["visualizationType"];
  naturalLanguageDescription: string;
  resolvedFilters?: {
    agentName: string | null;
  };
  dataUnavailable?: boolean;
  note?: string;
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 1;
  }
  return 1 - distance(a, b) / maxLen;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${suffix}`;
}

function coalesceHold(r: CanonicalCallRecord): number {
  return r.holdTime ?? 0;
}

function coalesceWrap(r: CanonicalCallRecord): number {
  return r.wrapUpTime ?? 0;
}

function handleSecondsForAht(r: CanonicalCallRecord): number {
  return (r.talkTime ?? 0) + coalesceHold(r) + coalesceWrap(r);
}

function sortRankDesc(
  keys: Array<{ key: string; value: number }>,
): Array<{ key: string; value: number }> {
  return keys.slice().sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
}

function incrementTalkHistogram(
  buckets: Array<{ bucket: "<30s" | "30s-2m" | "2m-5m" | "5m-10m" | ">10m"; calls: number }>,
  index: number,
): void {
  const item = buckets[index];
  if (item) {
    item.calls += 1;
  }
}

export class QueryExecutor {
  constructor(private readonly reportingTimeZone = "UTC") {}

  execute(query: ParsedQuery, records: CanonicalCallRecord[]): QueryResult {
    const resolvedAgent = query.filters.agentName
      ? this.resolveAgentName(query.filters.agentName, records)
      : null;

    const filtered = filterRecordsForQuery(query, records, resolvedAgent, this.reportingTimeZone);

    switch (query.metric) {
      case "total_calls":
        return this.wrap(filtered.length, query, resolvedAgent);
      case "total_talk_time":
        return this.wrap(
          filtered.reduce((s, r) => s + (r.talkTime ?? 0), 0),
          query,
          resolvedAgent,
        );
      case "total_wait_time":
        return this.wrap(
          filtered.reduce((s, r) => s + (r.waitTime ?? 0), 0),
          query,
          resolvedAgent,
        );
      case "total_hold_time":
        return this.totalHoldOrWrap(filtered, "hold", query, resolvedAgent);
      case "total_wrap_time":
        return this.totalHoldOrWrap(filtered, "wrap", query, resolvedAgent);
      case "avg_talk_time": {
        const n = filtered.length;
        const value = n > 0 ? round2(filtered.reduce((s, r) => s + (r.talkTime ?? 0), 0) / n) : 0;
        return this.wrap(value, query, resolvedAgent);
      }
      case "aht": {
        const n = filtered.length;
        if (n === 0) {
          return this.wrap(0, query, resolvedAgent);
        }
        const sumHandle = filtered.reduce((s, r) => s + handleSecondsForAht(r), 0);
        return this.wrap(round2(sumHandle / n), query, resolvedAgent);
      }
      case "avg_wait_time": {
        const n = filtered.length;
        const value = n > 0 ? round2(filtered.reduce((s, r) => s + (r.waitTime ?? 0), 0) / n) : 0;
        return this.wrap(value, query, resolvedAgent);
      }
      case "max_talk_time":
        return this.wrap(
          filtered.reduce((max, r) => Math.max(max, r.talkTime ?? 0), 0),
          query,
          resolvedAgent,
        );
      case "min_talk_time": {
        if (filtered.length === 0) {
          return this.wrap(0, query, resolvedAgent);
        }
        return this.wrap(
          filtered.reduce(
            (min, r) => Math.min(min, r.talkTime ?? Number.MAX_SAFE_INTEGER),
            Number.MAX_SAFE_INTEGER,
          ),
          query,
          resolvedAgent,
        );
      }
      case "call_distribution_by_hour":
        return this.distByHour(filtered, query, resolvedAgent);
      case "call_distribution_by_queue":
        return this.distByQueue(filtered, query, resolvedAgent);
      case "calls_by_day":
        return this.callsByDay(filtered, query, resolvedAgent);
      case "calls_by_disposition":
        return this.callsByDisposition(filtered, query, resolvedAgent);
      case "peak_hour":
        return this.peakHour(filtered, query, resolvedAgent);
      case "peak_day":
        return this.peakDay(filtered, query, resolvedAgent);
      case "talk_time_histogram":
        return this.talkTimeHistogram(filtered, query, resolvedAgent);
      case "service_level_pct":
        return this.serviceLevelPct(filtered, query, resolvedAgent);
      case "short_call_rate":
        return this.shortCallRate(filtered, query, resolvedAgent);
      case "long_call_rate":
        return this.longCallRate(filtered, query, resolvedAgent);
      case "avg_talk_by_agent":
        return this.avgTalkByAgent(filtered, query, resolvedAgent);
      case "avg_talk_by_queue":
        return this.avgTalkByQueue(filtered, query, resolvedAgent);
      case "avg_talk_by_hour":
        return this.avgTalkByHour(filtered, query, resolvedAgent);
      case "avg_wait_by_queue":
        return this.avgWaitByQueue(filtered, query, resolvedAgent);
      case "service_level_by_queue":
        return this.serviceLevelByQueue(filtered, query, resolvedAgent);
      case "calls_and_talk_by_queue":
        return this.callsAndTalkByQueue(filtered, query, resolvedAgent);
      case "calls_by_agent":
        return this.callsByAgent(filtered, query, resolvedAgent);
      case "avg_wait_by_agent":
        return this.avgWaitByAgent(filtered, query, resolvedAgent);
      case "top_n_agents":
        return this.topNAgentsByCallCount(filtered, query, resolvedAgent);
      case "top_n_agents_by_total_talk_time":
        return this.topNAgentsByTotalTalk(filtered, query, resolvedAgent);
      case "top_n_agents_by_avg_talk_time":
        return this.topNAgentsByAvgTalk(filtered, query, resolvedAgent);
      case "bottom_n_agents_by_call_count":
        return this.bottomNAgentsByCallCount(filtered, query, resolvedAgent);
      case "bottom_n_agents_by_total_talk_time":
        return this.bottomNAgentsByTotalTalkAsc(filtered, query, resolvedAgent);
      case "agent_share_pct":
        return this.agentSharePct(filtered, query, resolvedAgent);
      case "top_n_agents_by_total_wait_time":
        return this.topNAgentsByTotalWait(filtered, query, resolvedAgent);
      case "disposition_breakdown":
        return this.dispositionBreakdown(filtered, query, resolvedAgent);
      case "abandonment_rate":
        return this.abandonmentRate(filtered, query, resolvedAgent);
      case "answer_rate":
        return this.answerRate(filtered, query, resolvedAgent);
      case "transfer_rate":
      case "forward_rate":
        return this.transferRate(filtered, query, resolvedAgent);
      case "repeat_callers_count":
        return this.repeatCallersCount(filtered, query, resolvedAgent);
      case "top_callers_by_volume":
        return this.topCallersByVolume(filtered, query, resolvedAgent);
      case "calls_per_caller_distribution":
        return this.callsPerCallerDistribution(filtered, query, resolvedAgent);
      case "never_answered_repeat_callers":
        return this.neverAnsweredRepeatCallers(filtered, query, resolvedAgent);
      case "aht_ranking_by_agent":
        return this.ahtRankingByAgent(filtered, query, resolvedAgent);
      case "worst_hour_by_abandon_count":
        return this.worstHourByAbandonCount(filtered, query, resolvedAgent);
      case "abandon_analysis_bundle":
        return this.abandonAnalysisBundle(filtered, query, resolvedAgent);
      case "long_calls_by_agent_count":
        return this.longCallsByAgentCount(filtered, query, resolvedAgent);
      case "quick_call_red_flag_by_agent":
        return this.quickCallRedFlagByAgent(filtered, query, resolvedAgent);
      case "trainee_vs_tenured_compare":
        return this.traineeVsTenuredCompare(filtered, query, resolvedAgent);
    }
  }

  private totalHoldOrWrap(
    filtered: CanonicalCallRecord[],
    kind: "hold" | "wrap",
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const fieldPresent = filtered.some((r) =>
      kind === "hold" ? r.holdTime !== undefined : r.wrapUpTime !== undefined,
    );
    const sum = filtered.reduce(
      (s, r) => s + (kind === "hold" ? coalesceHold(r) : coalesceWrap(r)),
      0,
    );
    if (!fieldPresent) {
      return {
        value: 0,
        visualizationType: query.visualizationType,
        naturalLanguageDescription: query.naturalLanguageDescription,
        resolvedFilters: { agentName: resolvedAgent },
        dataUnavailable: true,
        note:
          kind === "hold" ? "holdTime not present in dataset" : "wrapUpTime not present in dataset",
      };
    }
    return this.wrap(sum, query, resolvedAgent);
  }

  private distByHour(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const bucket = new Map<string, number>();
    for (const record of filtered) {
      const hour =
        record.dateTime === undefined
          ? undefined
          : getHourInTimeZone(record.dateTime, this.reportingTimeZone);
      const key = hour === undefined ? "unknown" : `${hour}`;
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    return {
      value: Array.from(bucket.entries()).map(([key, value]) => ({ key, value })),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private distByQueue(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const bucket = new Map<string, number>();
    for (const record of filtered) {
      const key = record.queue ?? "unknown";
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    return {
      value: Array.from(bucket.entries()).map(([key, value]) => ({ key, value })),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private callsByDay(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const bucket = new Map<string, number>();
    for (const record of filtered) {
      if (!record.dateTime) {
        continue;
      }
      const key = formatDateKeyInTimeZone(record.dateTime, this.reportingTimeZone);
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    return {
      value: Array.from(bucket.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => ({ key, value })),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private callsByDisposition(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const bucket = new Map<string, number>();
    for (const record of filtered) {
      const key = record.disposition?.trim() || "unknown";
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    return {
      value: sortRankDesc(Array.from(bucket.entries()).map(([key, value]) => ({ key, value }))),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private peakHour(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byHour = new Map<number, number>();
    for (const record of filtered) {
      if (!record.dateTime) {
        continue;
      }
      const hour = getHourInTimeZone(record.dateTime, this.reportingTimeZone);
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    }
    let bestHour = 0;
    let bestCount = -1;
    for (const [h, c] of byHour.entries()) {
      if (c > bestCount || (c === bestCount && h < bestHour)) {
        bestHour = h;
        bestCount = c;
      }
    }
    if (bestCount < 0) {
      return this.wrap(0, query, resolvedAgent);
    }
    return {
      value: [{ key: hourLabel(bestHour), value: bestCount }],
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private peakDay(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const bucket = new Map<string, number>();
    for (const record of filtered) {
      if (!record.dateTime) {
        continue;
      }
      const key = formatDateKeyInTimeZone(record.dateTime, this.reportingTimeZone);
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    let bestDay = "";
    let bestCount = -1;
    for (const [d, c] of bucket.entries()) {
      if (c > bestCount || (c === bestCount && d.localeCompare(bestDay) < 0)) {
        bestDay = d;
        bestCount = c;
      }
    }
    if (bestCount < 0) {
      return this.wrap(0, query, resolvedAgent);
    }
    return {
      value: [{ key: bestDay, value: bestCount }],
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private talkTimeHistogram(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const talkTimeHistogram = [
      { bucket: "<30s" as const, calls: 0 },
      { bucket: "30s-2m" as const, calls: 0 },
      { bucket: "2m-5m" as const, calls: 0 },
      { bucket: "5m-10m" as const, calls: 0 },
      { bucket: ">10m" as const, calls: 0 },
    ];
    for (const record of filtered) {
      const talk = record.talkTime ?? 0;
      if (talk < 30) {
        incrementTalkHistogram(talkTimeHistogram, 0);
      } else if (talk < 120) {
        incrementTalkHistogram(talkTimeHistogram, 1);
      } else if (talk < 300) {
        incrementTalkHistogram(talkTimeHistogram, 2);
      } else if (talk < 600) {
        incrementTalkHistogram(talkTimeHistogram, 3);
      } else {
        incrementTalkHistogram(talkTimeHistogram, 4);
      }
    }
    return {
      value: talkTimeHistogram.map((b) => ({ key: b.bucket, value: b.calls })),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private serviceLevelPct(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const n = filtered.length;
    const pct =
      n > 0
        ? round2(
            (filtered.filter((r) => (r.waitTime ?? Number.MAX_SAFE_INTEGER) <= 20).length / n) *
              100,
          )
        : 0;
    return this.wrap(pct, query, resolvedAgent);
  }

  private shortCallRate(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const n = filtered.length;
    const pct =
      n > 0
        ? round2(
            (filtered.filter((r) => (r.talkTime ?? 0) < QUICK_CALL_THRESHOLD_SEC).length / n) * 100,
          )
        : 0;
    return this.wrap(pct, query, resolvedAgent);
  }

  private longCallRate(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const n = filtered.length;
    const pct =
      n > 0
        ? round2(
            (filtered.filter((r) => (r.talkTime ?? 0) >= LONG_CALL_THRESHOLD_SEC).length / n) * 100,
          )
        : 0;
    return this.wrap(pct, query, resolvedAgent);
  }

  private avgTalkByAgent(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = this.groupByAgent(filtered);
    const rows = Array.from(byAgent.entries()).map(([key, rows]) => {
      const n = rows.length;
      const avg = n > 0 ? round2(rows.reduce((s, r) => s + (r.talkTime ?? 0), 0) / n) : 0;
      return { key, value: avg };
    });
    return {
      value: sortRankDesc(rows),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private groupByAgent(records: CanonicalCallRecord[]): Map<string, CanonicalCallRecord[]> {
    const m = new Map<string, CanonicalCallRecord[]>();
    for (const record of records) {
      const key = record.agentName?.trim() ? record.agentName.trim() : "unknown";
      const cur = m.get(key) ?? [];
      cur.push(record);
      m.set(key, cur);
    }
    return m;
  }

  private avgTalkByQueue(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byQ = new Map<string, CanonicalCallRecord[]>();
    for (const record of filtered) {
      const key = record.queue?.trim() ? record.queue.trim() : "unknown";
      const cur = byQ.get(key) ?? [];
      cur.push(record);
      byQ.set(key, cur);
    }
    const rows = Array.from(byQ.entries()).map(([key, rows]) => {
      const n = rows.length;
      const avg = n > 0 ? round2(rows.reduce((s, r) => s + (r.talkTime ?? 0), 0) / n) : 0;
      return { key, value: avg };
    });
    return {
      value: sortRankDesc(rows),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private avgTalkByHour(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byHour = new Map<number, CanonicalCallRecord[]>();
    for (const record of filtered) {
      if (!record.dateTime) {
        continue;
      }
      const hour = getHourInTimeZone(record.dateTime, this.reportingTimeZone);
      const cur = byHour.get(hour) ?? [];
      cur.push(record);
      byHour.set(hour, cur);
    }
    const rows = Array.from(byHour.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, rows]) => {
        const n = rows.length;
        const avg = n > 0 ? round2(rows.reduce((s, r) => s + (r.talkTime ?? 0), 0) / n) : 0;
        return { key: hourLabel(hour), value: avg };
      });
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private avgWaitByQueue(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byQ = new Map<string, CanonicalCallRecord[]>();
    for (const record of filtered) {
      const key = record.queue?.trim() ? record.queue.trim() : "unknown";
      const cur = byQ.get(key) ?? [];
      cur.push(record);
      byQ.set(key, cur);
    }
    const rows = Array.from(byQ.entries()).map(([key, rows]) => {
      const n = rows.length;
      const avg = n > 0 ? round2(rows.reduce((s, r) => s + (r.waitTime ?? 0), 0) / n) : 0;
      return { key, value: avg };
    });
    return {
      value: sortRankDesc(rows),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private serviceLevelByQueue(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byQ = new Map<string, CanonicalCallRecord[]>();
    for (const record of filtered) {
      const key = record.queue?.trim() ? record.queue.trim() : "unknown";
      const cur = byQ.get(key) ?? [];
      cur.push(record);
      byQ.set(key, cur);
    }
    const rows = Array.from(byQ.entries()).map(([key, rows]) => {
      const n = rows.length;
      const pct =
        n > 0
          ? round2(
              (rows.filter((r) => (r.waitTime ?? Number.MAX_SAFE_INTEGER) <= 20).length / n) * 100,
            )
          : 0;
      return { key, value: pct };
    });
    return {
      value: sortRankDesc(rows),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private callsAndTalkByQueue(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byQ = new Map<string, CanonicalCallRecord[]>();
    for (const record of filtered) {
      const key = record.queue?.trim() ? record.queue.trim() : "unknown";
      const cur = byQ.get(key) ?? [];
      cur.push(record);
      byQ.set(key, cur);
    }
    const rows: Array<{ key: string; value: number }> = [];
    for (const [q, rowsQ] of Array.from(byQ.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      const calls = rowsQ.length;
      const talk = rowsQ.reduce((s, r) => s + (r.talkTime ?? 0), 0);
      rows.push({ key: `${q} — calls`, value: calls });
      rows.push({ key: `${q} — total talk (s)`, value: talk });
    }
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private callsByAgent(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = this.groupByAgent(filtered);
    const rows = Array.from(byAgent.entries()).map(([key, rows]) => ({ key, value: rows.length }));
    return {
      value: sortRankDesc(rows),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private avgWaitByAgent(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = new Map<string, CanonicalCallRecord[]>();
    for (const record of filtered) {
      const agent = record.agentName?.trim();
      if (!agent) {
        continue;
      }
      const cur = byAgent.get(agent) ?? [];
      cur.push(record);
      byAgent.set(agent, cur);
    }
    const rows = Array.from(byAgent.entries()).map(([key, rows]) => {
      const n = rows.length;
      const avg = n > 0 ? round2(rows.reduce((s, r) => s + (r.waitTime ?? 0), 0) / n) : 0;
      return { key, value: avg };
    });
    return {
      value: sortRankDesc(rows),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private topNAgentsByCallCount(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = this.groupByAgent(filtered);
    const n = query.parameters.n > 0 ? query.parameters.n : 5;
    const rows = sortRankDesc(
      Array.from(byAgent.entries()).map(([key, rows]) => ({ key, value: rows.length })),
    ).slice(0, n);
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private topNAgentsByTotalTalk(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = this.groupByAgent(filtered);
    const n = query.parameters.n > 0 ? query.parameters.n : 5;
    const rows = sortRankDesc(
      Array.from(byAgent.entries()).map(([key, rows]) => ({
        key,
        value: rows.reduce((s, r) => s + (r.talkTime ?? 0), 0),
      })),
    ).slice(0, n);
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private topNAgentsByAvgTalk(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = this.groupByAgent(filtered);
    const n = query.parameters.n > 0 ? query.parameters.n : 5;
    const rows = sortRankDesc(
      Array.from(byAgent.entries()).map(([key, rows]) => {
        const len = rows.length;
        const avg = len > 0 ? round2(rows.reduce((s, r) => s + (r.talkTime ?? 0), 0) / len) : 0;
        return { key, value: avg };
      }),
    ).slice(0, n);
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private bottomNAgentsByCallCount(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = this.groupByAgent(filtered);
    const n = query.parameters.n > 0 ? query.parameters.n : 5;
    const rows = sortRankDesc(
      Array.from(byAgent.entries()).map(([key, rows]) => ({ key, value: rows.length })),
    )
      .slice()
      .reverse()
      .slice(0, n);
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private bottomNAgentsByTotalTalkAsc(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = this.groupByAgent(filtered);
    const n = query.parameters.n > 0 ? query.parameters.n : 5;
    const rows = Array.from(byAgent.entries())
      .map(([key, rows]) => ({
        key,
        value: rows.reduce((s, r) => s + (r.talkTime ?? 0), 0),
      }))
      .sort((a, b) => a.value - b.value || a.key.localeCompare(b.key))
      .slice(0, n);
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private agentSharePct(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const total = filtered.length;
    const byAgent = this.groupByAgent(filtered);
    const rows = Array.from(byAgent.entries()).map(([key, rows]) => ({
      key,
      value: total > 0 ? round2((rows.length / total) * 100) : 0,
    }));
    return {
      value: sortRankDesc(rows),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private topNAgentsByTotalWait(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = new Map<string, CanonicalCallRecord[]>();
    for (const record of filtered) {
      const agent = record.agentName?.trim();
      if (!agent) {
        continue;
      }
      const cur = byAgent.get(agent) ?? [];
      cur.push(record);
      byAgent.set(agent, cur);
    }
    const n = query.parameters.n > 0 ? query.parameters.n : 5;
    const rows = sortRankDesc(
      Array.from(byAgent.entries()).map(([key, rows]) => ({
        key,
        value: rows.reduce((s, r) => s + (r.waitTime ?? 0), 0),
      })),
    ).slice(0, n);
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private dispositionBreakdown(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    return this.callsByDisposition(filtered, query, resolvedAgent);
  }

  private abandonmentRate(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const n = filtered.length;
    const pct =
      n > 0
        ? round2(
            (filtered.filter((r) => normalizeDisposition(r.disposition) === "abandoned").length /
              n) *
              100,
          )
        : 0;
    return this.wrap(pct, query, resolvedAgent);
  }

  private answerRate(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const n = filtered.length;
    const pct =
      n > 0
        ? round2(
            (filtered.filter((r) => normalizeDisposition(r.disposition) === "answered").length /
              n) *
              100,
          )
        : 0;
    return this.wrap(pct, query, resolvedAgent);
  }

  private transferRate(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const dispositionPresent = filtered.some(
      (r) => r.disposition !== undefined && r.disposition.trim() !== "",
    );
    const n = filtered.length;
    const pct =
      n > 0
        ? round2((filtered.filter((r) => isTransferDisposition(r.disposition)).length / n) * 100)
        : 0;
    if (!dispositionPresent) {
      return {
        value: 0,
        visualizationType: query.visualizationType,
        naturalLanguageDescription: query.naturalLanguageDescription,
        resolvedFilters: { agentName: resolvedAgent },
        dataUnavailable: true,
        note: "disposition not present in dataset",
      };
    }
    return this.wrap(pct, query, resolvedAgent);
  }

  private repeatCallersCount(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const present = filtered.some(
      (r) => r.callerPhone !== undefined && (r.callerPhone ?? "").trim() !== "",
    );
    if (!present) {
      return {
        value: 0,
        visualizationType: query.visualizationType,
        naturalLanguageDescription: query.naturalLanguageDescription,
        resolvedFilters: { agentName: resolvedAgent },
        dataUnavailable: true,
        note: "callerPhone not present in dataset",
      };
    }
    const counts = new Map<string, number>();
    for (const record of filtered) {
      const p = record.callerPhone?.trim();
      if (!p) {
        continue;
      }
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const repeaters = Array.from(counts.values()).filter((c) => c >= 2).length;
    return this.wrap(repeaters, query, resolvedAgent);
  }

  private topCallersByVolume(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const present = filtered.some(
      (r) => r.callerPhone !== undefined && (r.callerPhone ?? "").trim() !== "",
    );
    if (!present) {
      return {
        value: [],
        visualizationType: query.visualizationType,
        naturalLanguageDescription: query.naturalLanguageDescription,
        resolvedFilters: { agentName: resolvedAgent },
        dataUnavailable: true,
        note: "callerPhone not present in dataset",
      };
    }
    const counts = new Map<string, number>();
    for (const record of filtered) {
      const p = record.callerPhone?.trim();
      if (!p) {
        continue;
      }
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const n = query.parameters.n > 0 ? query.parameters.n : 5;
    const rows = sortRankDesc(
      Array.from(counts.entries()).map(([key, value]) => ({ key, value })),
    ).slice(0, n);
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private callsPerCallerDistribution(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const present = filtered.some(
      (r) => r.callerPhone !== undefined && (r.callerPhone ?? "").trim() !== "",
    );
    if (!present) {
      return {
        value: [],
        visualizationType: query.visualizationType,
        naturalLanguageDescription: query.naturalLanguageDescription,
        resolvedFilters: { agentName: resolvedAgent },
        dataUnavailable: true,
        note: "callerPhone not present in dataset",
      };
    }
    const counts = new Map<string, number>();
    for (const record of filtered) {
      const p = record.callerPhone?.trim();
      if (!p) {
        continue;
      }
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const dist = new Map<string, number>();
    for (const c of counts.values()) {
      const label = c >= 5 ? "5+" : `${c}`;
      dist.set(label, (dist.get(label) ?? 0) + 1);
    }
    const order = ["1", "2", "3", "4", "5+"];
    const rows = order
      .map((k) => ({ key: `${k} call(s)`, value: dist.get(k) ?? 0 }))
      .filter((r) => r.value > 0);
    return {
      value: rows.length > 0 ? rows : [{ key: "callers (no distribution)", value: 0 }],
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private neverAnsweredRepeatCallers(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const present = filtered.some(
      (r) => r.callerPhone !== undefined && (r.callerPhone ?? "").trim() !== "",
    );
    if (!present) {
      return {
        value: 0,
        visualizationType: query.visualizationType,
        naturalLanguageDescription: query.naturalLanguageDescription,
        resolvedFilters: { agentName: resolvedAgent },
        dataUnavailable: true,
        note: "callerPhone not present in dataset",
      };
    }
    const byCaller = new Map<string, CanonicalCallRecord[]>();
    for (const record of filtered) {
      const p = record.callerPhone?.trim();
      if (!p) {
        continue;
      }
      const cur = byCaller.get(p) ?? [];
      cur.push(record);
      byCaller.set(p, cur);
    }
    let count = 0;
    const table: Array<{ key: string; value: number }> = [];
    for (const [phone, calls] of byCaller.entries()) {
      if (calls.length < 2) {
        continue;
      }
      const anyAnswered = calls.some((c) => isAnsweredDisposition(c.disposition));
      if (!anyAnswered) {
        count += 1;
        table.push({ key: phone, value: calls.length });
      }
    }
    const value: Array<{ key: string; value: number }> = [
      { key: "distinct_never_answered_repeat_callers", value: count },
      ...sortRankDesc(table),
    ];
    return {
      value,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private ahtRankingByAgent(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = this.groupByAgent(filtered);
    const rows = sortRankDesc(
      Array.from(byAgent.entries()).map(([key, rows]) => {
        const n = rows.length;
        const avgAht = n > 0 ? round2(rows.reduce((s, r) => s + handleSecondsForAht(r), 0) / n) : 0;
        return { key, value: avgAht };
      }),
    );
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private worstHourByAbandonCount(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byHour = new Map<number, number>();
    for (const record of filtered) {
      if (normalizeDisposition(record.disposition) !== "abandoned") {
        continue;
      }
      if (!record.dateTime) {
        continue;
      }
      const hour = getHourInTimeZone(record.dateTime, this.reportingTimeZone);
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    }
    let bestH = 0;
    let bestC = -1;
    for (const [h, c] of byHour.entries()) {
      if (c > bestC || (c === bestC && h < bestH)) {
        bestH = h;
        bestC = c;
      }
    }
    if (bestC < 0) {
      return {
        value: [{ key: "N/A", value: 0 }],
        visualizationType: query.visualizationType,
        naturalLanguageDescription: query.naturalLanguageDescription,
        resolvedFilters: { agentName: resolvedAgent },
      };
    }
    return {
      value: [{ key: hourLabel(bestH), value: bestC }],
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private abandonAnalysisBundle(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const abandoned = filtered.filter((r) => normalizeDisposition(r.disposition) === "abandoned");
    const totalAbandon = abandoned.length;
    const avgWaitAbandoned =
      totalAbandon > 0
        ? round2(abandoned.reduce((s, r) => s + (r.waitTime ?? 0), 0) / totalAbandon)
        : 0;
    const byHour = new Map<number, number>();
    for (const record of abandoned) {
      if (!record.dateTime) {
        continue;
      }
      const hour = getHourInTimeZone(record.dateTime, this.reportingTimeZone);
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    }
    let worstH = 0;
    let worstC = -1;
    for (const [h, c] of byHour.entries()) {
      if (c > worstC || (c === worstC && h < worstH)) {
        worstH = h;
        worstC = c;
      }
    }
    const rows: Array<{ key: string; value: number }> = [
      { key: "Abandoned calls (count)", value: totalAbandon },
      { key: "Avg wait when abandoned (s)", value: avgWaitAbandoned },
    ];
    if (worstC >= 0) {
      rows.push({ key: `Worst hour by abandons (${hourLabel(worstH)})`, value: worstC });
    }
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private longCallsByAgentCount(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = this.groupByAgent(filtered);
    const rows = sortRankDesc(
      Array.from(byAgent.entries()).map(([key, rows]) => ({
        key,
        value: rows.filter((r) => (r.talkTime ?? 0) >= LONG_CALL_THRESHOLD_SEC).length,
      })),
    );
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private quickCallRedFlagByAgent(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const byAgent = this.groupByAgent(filtered);
    const rows: Array<{ key: string; value: number }> = [];
    for (const [agent, rowsA] of byAgent.entries()) {
      const n = rowsA.length;
      if (n < QUICK_CALL_MIN_AGENT_CALLS) {
        continue;
      }
      const shortN = rowsA.filter((r) => (r.talkTime ?? 0) < QUICK_CALL_THRESHOLD_SEC).length;
      const ratePct = (shortN / n) * 100;
      if (ratePct >= QUICK_CALL_RED_FLAG_RATE_PCT) {
        rows.push({
          key: `${agent} (sub-${QUICK_CALL_THRESHOLD_SEC}s share %)`,
          value: round2(ratePct),
        });
      }
    }
    return {
      value: sortRankDesc(rows),
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private traineeSegment(customTag: string | undefined): "trainee" | "tenured" | null {
    const t = customTag?.trim().toLowerCase() ?? "";
    if (t.includes("trainee")) {
      return "trainee";
    }
    if (t.includes("tenured") || t.includes("experienced")) {
      return "tenured";
    }
    return null;
  }

  private traineeVsTenuredCompare(
    filtered: CanonicalCallRecord[],
    query: ParsedQuery,
    resolvedAgent: string | null,
  ): QueryResult {
    const buckets: { trainee: CanonicalCallRecord[]; tenured: CanonicalCallRecord[] } = {
      trainee: [],
      tenured: [],
    };
    for (const record of filtered) {
      const seg = this.traineeSegment(record.customTag);
      if (seg === "trainee") {
        buckets.trainee.push(record);
      } else if (seg === "tenured") {
        buckets.tenured.push(record);
      }
    }
    if (buckets.trainee.length === 0 && buckets.tenured.length === 0) {
      return {
        value: [],
        visualizationType: query.visualizationType,
        naturalLanguageDescription: query.naturalLanguageDescription,
        resolvedFilters: { agentName: resolvedAgent },
        dataUnavailable: true,
        note: "No customTag trainee/tenured labels in dataset — use dashboard agent comparison with manual selection",
      };
    }
    const sumTalk = (rs: CanonicalCallRecord[]) => rs.reduce((s, r) => s + (r.talkTime ?? 0), 0);
    const rows: Array<{ key: string; value: number }> = [
      {
        key: "trainee — calls",
        value: buckets.trainee.length,
      },
      {
        key: "trainee — avg talk (s)",
        value:
          buckets.trainee.length > 0
            ? round2(sumTalk(buckets.trainee) / buckets.trainee.length)
            : 0,
      },
      {
        key: "tenured — calls",
        value: buckets.tenured.length,
      },
      {
        key: "tenured — avg talk (s)",
        value:
          buckets.tenured.length > 0
            ? round2(sumTalk(buckets.tenured) / buckets.tenured.length)
            : 0,
      },
    ];
    return {
      value: rows,
      visualizationType: query.visualizationType,
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  /** Scalar metrics always return a single number; UI only shows it when `visualizationType` is `"number"`. */
  private wrap(value: number, query: ParsedQuery, resolvedAgent: string | null): QueryResult {
    return {
      value,
      visualizationType: "number",
      naturalLanguageDescription: query.naturalLanguageDescription,
      resolvedFilters: { agentName: resolvedAgent },
    };
  }

  private resolveAgentName(partial: string, records: CanonicalCallRecord[]): string | null {
    const requested = partial.trim().toLowerCase();
    const candidates = Array.from(
      new Set(
        records
          .map((record) => record.agentName?.trim())
          .filter((value): value is string => Boolean(value))
          .map((value) => value.toLowerCase()),
      ),
    );

    const includesMatch = candidates.find(
      (candidate) => candidate.includes(requested) || requested.includes(candidate),
    );
    if (includesMatch) {
      const original =
        records.find((record) => (record.agentName ?? "").toLowerCase() === includesMatch)
          ?.agentName ?? includesMatch;
      return original;
    }

    if (candidates.length === 0) {
      return null;
    }
    const best = closest(requested, candidates);
    if (!best) {
      return null;
    }

    if (similarity(requested, best) > 0.75) {
      const original =
        records.find((record) => (record.agentName ?? "").toLowerCase() === best)?.agentName ??
        best;
      return original;
    }
    return null;
  }
}
