import type { CanonicalCallRecord, DashboardResult } from "./analytics.types.js";
import { normalizeDisposition } from "./disposition-utils.js";
import { formatDateKeyInTimeZone, getHourInTimeZone } from "./reporting-timezone.js";

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${suffix}`;
}

function incrementBucket(
  buckets: Array<{ bucket: "<30s" | "30s-2m" | "2m-5m" | "5m-10m" | ">10m"; calls: number }>,
  index: number,
): void {
  const item = buckets[index];
  if (!item) {
    return;
  }
  item.calls += 1;
}

export class AnalyticsService {
  constructor(private readonly reportingTimeZone = "UTC") {}

  computeDashboard(records: CanonicalCallRecord[]): DashboardResult {
    const totalCalls = records.length;
    const totalTalkTime = records.reduce((sum, r) => sum + (r.talkTime ?? 0), 0);
    const totalWaitTime = records.reduce((sum, r) => sum + (r.waitTime ?? 0), 0);
    const avgTalkTime = totalCalls > 0 ? totalTalkTime / totalCalls : 0;
    const avgWaitTime = totalCalls > 0 ? totalWaitTime / totalCalls : 0;
    const serviceLevel =
      totalCalls > 0
        ? (records.filter((r) => (r.waitTime ?? Number.MAX_SAFE_INTEGER) <= 20).length /
            totalCalls) *
          100
        : 0;
    const shortCallRate =
      totalCalls > 0
        ? (records.filter((r) => (r.talkTime ?? 0) < 30).length / totalCalls) * 100
        : 0;
    const answeredCalls = records.filter(
      (r) => normalizeDisposition(r.disposition) === "answered",
    ).length;
    const abandonedCalls = records.filter(
      (r) => normalizeDisposition(r.disposition) === "abandoned",
    ).length;
    const longCalls5m = records.filter((r) => (r.talkTime ?? 0) >= 300).length;
    const answerRate = totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0;
    const longestCall = records.reduce((max, r) => Math.max(max, r.talkTime ?? 0), 0);

    const uniqueAgents = new Set(
      records.map((r) => r.agentName?.trim()).filter((value): value is string => Boolean(value)),
    );
    const uniqueQueues = Array.from(
      new Set(
        records.map((r) => r.queue?.trim()).filter((value): value is string => Boolean(value)),
      ),
    );

    const byHour = new Map<number, CanonicalCallRecord[]>();
    for (const record of records) {
      if (!record.dateTime) {
        continue;
      }
      const hour = getHourInTimeZone(record.dateTime, this.reportingTimeZone);
      const current = byHour.get(hour) ?? [];
      current.push(record);
      byHour.set(hour, current);
    }

    let peakHour = "N/A";
    let peakHourCalls = 0;
    for (const [hour, hourRecords] of byHour.entries()) {
      if (hourRecords.length > peakHourCalls) {
        peakHourCalls = hourRecords.length;
        peakHour = hourLabel(hour);
      }
    }

    const byAgent = new Map<string, CanonicalCallRecord[]>();
    for (const record of records) {
      const agent = record.agentName?.trim();
      if (!agent) {
        continue;
      }
      const current = byAgent.get(agent) ?? [];
      current.push(record);
      byAgent.set(agent, current);
    }

    let peakAgent = "N/A";
    let peakAgentCalls = 0;
    for (const [agent, agentRecords] of byAgent.entries()) {
      if (agentRecords.length > peakAgentCalls) {
        peakAgent = agent;
        peakAgentCalls = agentRecords.length;
      }
    }

    const hourlyCallVolume = Array.from(byHour.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, hourRecords]) => ({
        hour: hourLabel(hour),
        calls: hourRecords.length,
      }));

    const hourlyDispositionStack = Array.from(byHour.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, hourRecords]) => {
        let answered = 0;
        let abandoned = 0;
        let forwarded = 0;
        let other = 0;
        for (const record of hourRecords) {
          const disposition = normalizeDisposition(record.disposition);
          if (disposition === "answered") {
            answered += 1;
          } else if (disposition === "abandoned") {
            abandoned += 1;
          } else if (disposition === "forwarded") {
            forwarded += 1;
          } else {
            other += 1;
          }
        }
        return { hour: hourLabel(hour), answered, abandoned, forwarded, other };
      });

    const queueDistribution = Array.from(
      records
        .reduce((acc, record) => {
          const queue = record.queue?.trim();
          if (!queue) {
            return acc;
          }
          acc.set(queue, (acc.get(queue) ?? 0) + 1);
          return acc;
        }, new Map<string, number>())
        .entries(),
    ).map(([queue, calls]) => ({ queue, calls }));

    const talkTimeHistogram = [
      { bucket: "<30s" as const, calls: 0 },
      { bucket: "30s-2m" as const, calls: 0 },
      { bucket: "2m-5m" as const, calls: 0 },
      { bucket: "5m-10m" as const, calls: 0 },
      { bucket: ">10m" as const, calls: 0 },
    ];
    for (const record of records) {
      const talk = record.talkTime ?? 0;
      if (talk < 30) {
        incrementBucket(talkTimeHistogram, 0);
      } else if (talk < 120) {
        incrementBucket(talkTimeHistogram, 1);
      } else if (talk < 300) {
        incrementBucket(talkTimeHistogram, 2);
      } else if (talk < 600) {
        incrementBucket(talkTimeHistogram, 3);
      } else {
        incrementBucket(talkTimeHistogram, 4);
      }
    }

    const avgTalkByHour = Array.from(byHour.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, hourRecords]) => ({
        hour: hourLabel(hour),
        avgTalk: round(
          hourRecords.reduce((sum, r) => sum + (r.talkTime ?? 0), 0) / hourRecords.length,
        ),
      }));

    const waitTimeByHour = Array.from(byHour.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, hourRecords]) => ({
        hour: hourLabel(hour),
        avgWait: round(
          hourRecords.reduce((sum, r) => sum + (r.waitTime ?? 0), 0) / hourRecords.length,
        ),
      }));

    const agentPerformance = Array.from(byAgent.entries()).map(([agentName, agentRecords]) => {
      const calls = agentRecords.length;
      const totalTalk = agentRecords.reduce((sum, r) => sum + (r.talkTime ?? 0), 0);
      const totalWait = agentRecords.reduce((sum, r) => sum + (r.waitTime ?? 0), 0);
      return {
        agentName,
        calls,
        totalTalk,
        avgTalk: round(totalTalk / calls),
        avgWait: round(totalWait / calls),
        sharePct: totalCalls > 0 ? round((calls / totalCalls) * 100) : 0,
        shortCalls: agentRecords.filter((r) => (r.talkTime ?? 0) < 30).length,
        mediumCalls: agentRecords.filter((r) => (r.talkTime ?? 0) >= 30 && (r.talkTime ?? 0) < 120)
          .length,
        longCalls: agentRecords.filter((r) => (r.talkTime ?? 0) >= 120 && (r.talkTime ?? 0) < 300)
          .length,
        extraLongCalls: agentRecords.filter((r) => (r.talkTime ?? 0) >= 300).length,
      };
    });

    const agentHourHeatmap = Array.from(
      records.reduce((acc, record) => {
        const agent = record.agentName?.trim();
        const hour =
          record.dateTime === undefined
            ? undefined
            : getHourInTimeZone(record.dateTime, this.reportingTimeZone);
        if (!agent || hour === undefined) {
          return acc;
        }
        const key = `${agent}::${hour}`;
        const current = acc.get(key) ?? { agent, hour, count: 0 };
        current.count += 1;
        acc.set(key, current);
        return acc;
      }, new Map<string, { agent: string; hour: number; count: number }>()),
    ).map(([, value]) => value);

    const byDate = records.reduce((acc, record) => {
      if (!record.dateTime) {
        return acc;
      }
      const date = formatDateKeyInTimeZone(record.dateTime, this.reportingTimeZone);
      acc.set(date, (acc.get(date) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
    const dailyTrend =
      byDate.size > 1
        ? Array.from(byDate.entries()).map(([date, calls]) => ({ date, calls }))
        : undefined;

    const byDisposition = records.reduce((acc, record) => {
      const disposition = record.disposition?.trim();
      if (!disposition) {
        return acc;
      }
      acc.set(disposition, (acc.get(disposition) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
    const dispositionBreakdown =
      byDisposition.size > 0
        ? Array.from(byDisposition.entries()).map(([disposition, calls]) => ({
            disposition,
            calls,
          }))
        : undefined;

    const topAgents = agentPerformance
      .slice()
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 5)
      .map(({ agentName, calls }) => ({ agentName, calls }));

    const repeatCallerRows = Array.from(
      records.reduce((acc, record) => {
        const callerPhone = record.callerPhone?.trim();
        if (!callerPhone) {
          return acc;
        }
        acc.set(callerPhone, (acc.get(callerPhone) ?? 0) + 1);
        return acc;
      }, new Map<string, number>()),
    )
      .filter(([, calls]) => calls >= 2)
      .sort((a, b) => b[1] - a[1]);

    const totalRepeatCallers = repeatCallerRows.length;
    const totalRepeatCalls = repeatCallerRows.reduce((sum, [, calls]) => sum + calls, 0);
    const topRepeatCallers = repeatCallerRows
      .slice(0, 5)
      .map(([callerPhone, calls]) => ({ callerPhone, calls }));

    const abandonedRate = totalCalls > 0 ? (abandonedCalls / totalCalls) * 100 : 0;
    const recommendation =
      abandonedRate >= 20
        ? `Abandonment is ${round(abandonedRate)}%. Add staffing around ${peakHour} and monitor queue spikes.`
        : `Abandonment is stable at ${round(abandonedRate)}%. Keep staffing near ${peakHour} and focus on long-call coaching.`;

    return {
      kpis: {
        totalCalls,
        totalTalkTime,
        totalWaitTime,
        avgHandleTime: round(avgTalkTime),
        avgTalkTime: round(avgTalkTime),
        avgWaitTime: round(avgWaitTime),
        serviceLevel: round(serviceLevel),
        shortCallRate: round(shortCallRate),
        longestCall,
        agentCount: uniqueAgents.size,
        callsPerAgent: uniqueAgents.size > 0 ? round(totalCalls / uniqueAgents.size) : 0,
        peakHour,
        peakAgent,
        totalAgents: uniqueAgents.size,
        queues: uniqueQueues,
        answerRate: round(answerRate),
        abandonedCalls,
        longCalls5m,
      },
      charts: {
        hourlyCallVolume,
        queueDistribution,
        talkTimeHistogram,
        avgTalkByHour,
        agentPerformance,
        agentHourHeatmap,
        dailyTrend,
        dispositionBreakdown,
        topAgents,
        waitTimeByHour,
        hourlyDispositionStack,
      },
      intelligence: {
        repeatCallerSummary: {
          totalRepeatCallers,
          totalRepeatCalls,
          topRepeatCallers,
        },
        recommendation,
      },
    };
  }
}
