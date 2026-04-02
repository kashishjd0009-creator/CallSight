import { describe, expect, it } from "vitest";

import { AnalyticsService } from "../analytics.service.js";
import type { CanonicalCallRecord } from "../analytics.types.js";

function makeRecord(overrides: Partial<CanonicalCallRecord> = {}): CanonicalCallRecord {
  return {
    callId: crypto.randomUUID(),
    agentName: "Agent A",
    queue: "Support",
    talkTime: 60,
    waitTime: 10,
    dateTime: new Date("2026-04-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("AnalyticsService", () => {
  const service = new AnalyticsService("UTC");

  it("returns zeroed KPIs for empty dataset", () => {
    const result = service.computeDashboard([]);
    expect(result.kpis.totalCalls).toBe(0);
    expect(result.kpis.totalTalkTime).toBe(0);
    expect(result.kpis.totalWaitTime).toBe(0);
    expect(result.kpis.avgTalkTime).toBe(0);
    expect(result.kpis.serviceLevel).toBe(0);
    expect(result.kpis.agentCount).toBe(0);
  });

  it("computes KPIs for one row", () => {
    const records = [makeRecord({ talkTime: 120, waitTime: 15, agentName: "Solo Agent" })];
    const result = service.computeDashboard(records);
    expect(result.kpis.totalCalls).toBe(1);
    expect(result.kpis.totalTalkTime).toBe(120);
    expect(result.kpis.totalWaitTime).toBe(15);
    expect(result.kpis.avgTalkTime).toBe(120);
    expect(result.kpis.avgHandleTime).toBe(120);
    expect(result.kpis.serviceLevel).toBe(100);
    expect(result.kpis.shortCallRate).toBe(0);
    expect(result.kpis.longestCall).toBe(120);
    expect(result.kpis.agentCount).toBe(1);
    expect(result.kpis.peakAgent).toBe("Solo Agent");
  });

  it("computes KPIs for multi-row dataset and chart sections", () => {
    const records: CanonicalCallRecord[] = [
      makeRecord({
        agentName: "Justin Taylor",
        queue: "Sales",
        talkTime: 25,
        waitTime: 30,
        dateTime: new Date("2026-04-01T09:10:00.000Z"),
      }),
      makeRecord({
        agentName: "Justin Taylor",
        queue: "Sales",
        talkTime: 240,
        waitTime: 5,
        dateTime: new Date("2026-04-01T09:40:00.000Z"),
        disposition: "answered",
      }),
      makeRecord({
        agentName: "Alex Doe",
        queue: "Support",
        talkTime: 610,
        waitTime: 18,
        dateTime: new Date("2026-04-02T11:00:00.000Z"),
        disposition: "answered",
      }),
    ];

    const result = service.computeDashboard(records);
    expect(result.kpis.totalCalls).toBe(3);
    expect(result.kpis.totalTalkTime).toBe(875);
    expect(result.kpis.totalWaitTime).toBe(53);
    expect(result.kpis.avgTalkTime).toBeCloseTo(291.67, 2);
    expect(result.kpis.shortCallRate).toBeCloseTo(33.33, 2);
    expect(result.kpis.longestCall).toBe(610);
    expect(result.kpis.agentCount).toBe(2);
    expect(result.kpis.queues.sort()).toEqual(["Sales", "Support"]);
    expect(result.charts.hourlyCallVolume.length).toBeGreaterThan(0);
    expect(result.charts.queueDistribution.length).toBe(2);
    expect(result.charts.agentHourHeatmap.length).toBeGreaterThan(0);
    expect(result.charts.topAgents.length).toBe(2);
    expect(result.charts.dailyTrend?.length).toBe(2);
    expect(result.charts.dispositionBreakdown?.length).toBe(1);
    expect(result.kpis.answerRate).toBeCloseTo(66.67, 2);
    expect(result.kpis.abandonedCalls).toBe(0);
    expect(result.kpis.longCalls5m).toBe(1);
    expect(result.charts.hourlyDispositionStack.length).toBeGreaterThan(0);
    expect(result.intelligence.recommendation.length).toBeGreaterThan(0);
    expect(result.intelligence.repeatCallerSummary.totalRepeatCallers).toBe(0);
  });

  it("handles dataset with one agent correctly", () => {
    const records = [
      makeRecord({ agentName: "One Agent", talkTime: 45, waitTime: 10 }),
      makeRecord({ agentName: "One Agent", talkTime: 55, waitTime: 25 }),
    ];
    const result = service.computeDashboard(records);
    expect(result.kpis.agentCount).toBe(1);
    expect(result.kpis.callsPerAgent).toBe(2);
    expect(result.kpis.peakAgent).toBe("One Agent");
  });

  it("computes repeat caller intelligence and disposition stacked rows", () => {
    const records: CanonicalCallRecord[] = [
      makeRecord({
        callerPhone: "+1-202-555-0100",
        talkTime: 420,
        disposition: "answered",
        dateTime: new Date("2026-04-01T09:10:00.000Z"),
      }),
      makeRecord({
        callerPhone: "+1-202-555-0100",
        talkTime: 15,
        disposition: "abandoned",
        dateTime: new Date("2026-04-01T09:20:00.000Z"),
      }),
      makeRecord({
        callerPhone: "+1-202-555-0100",
        talkTime: 35,
        disposition: "answered",
        dateTime: new Date("2026-04-01T10:20:00.000Z"),
      }),
      makeRecord({
        callerPhone: "+1-202-555-0199",
        talkTime: 50,
        disposition: "forwarded",
        dateTime: new Date("2026-04-01T10:50:00.000Z"),
      }),
    ];

    const result = service.computeDashboard(records);
    expect(result.kpis.answerRate).toBe(50);
    expect(result.kpis.abandonedCalls).toBe(1);
    expect(result.kpis.longCalls5m).toBe(1);
    expect(result.charts.hourlyDispositionStack).toEqual([
      { hour: "9:00 AM", answered: 1, abandoned: 1, forwarded: 0, other: 0 },
      { hour: "10:00 AM", answered: 1, abandoned: 0, forwarded: 1, other: 0 },
    ]);
    expect(result.intelligence.repeatCallerSummary.totalRepeatCallers).toBe(1);
    expect(result.intelligence.repeatCallerSummary.totalRepeatCalls).toBe(3);
    expect(result.intelligence.repeatCallerSummary.topRepeatCallers[0]?.callerPhone).toContain(
      "0100",
    );
  });

  it("buckets hourly metrics using the reporting IANA time zone", () => {
    const chicago = new AnalyticsService("America/Chicago");
    const records = [makeRecord({ dateTime: new Date("2026-04-01T07:00:00.000Z") })];
    const chicagoDash = chicago.computeDashboard(records);
    expect(chicagoDash.kpis.peakHour).toBe("2:00 AM");
    expect(chicagoDash.charts.hourlyCallVolume).toEqual([{ hour: "2:00 AM", calls: 1 }]);

    const utcDash = service.computeDashboard(records);
    expect(utcDash.kpis.peakHour).toBe("7:00 AM");
    expect(utcDash.charts.hourlyCallVolume).toEqual([{ hour: "7:00 AM", calls: 1 }]);
  });

  it("counts missing and unknown dispositions as other in hourly disposition stack", () => {
    const records: CanonicalCallRecord[] = [
      makeRecord({
        dateTime: new Date("2026-04-01T14:05:00.000Z"),
        disposition: undefined,
        talkTime: 30,
      }),
      makeRecord({
        dateTime: new Date("2026-04-01T14:25:00.000Z"),
        disposition: "voicemail",
        talkTime: 20,
      }),
      makeRecord({
        dateTime: new Date("2026-04-01T14:55:00.000Z"),
        disposition: "answered",
        talkTime: 60,
      }),
    ];
    const result = service.computeDashboard(records);
    const hourRow = result.charts.hourlyDispositionStack.find((r) => r.hour === "2:00 PM");
    expect(hourRow).toEqual({
      hour: "2:00 PM",
      answered: 1,
      abandoned: 0,
      forwarded: 0,
      other: 2,
    });
  });
});
