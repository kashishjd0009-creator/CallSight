import { describe, expect, it } from "vitest";

import {
  filterCanonicalRecords,
  parseAnalyticsFilters,
  uniqueFieldValues,
} from "../analytics.filters.js";

describe("analytics.filters", () => {
  it("parseAnalyticsFilters reads queue, agent, hour range, disposition, minTalkTime", () => {
    const f = parseAnalyticsFilters({
      queue: "Sales",
      agent: "Alex",
      hourFrom: "9",
      hourTo: "17",
      disposition: "answered",
      minTalkTime: "120",
    });
    expect(f).toEqual({
      queue: "Sales",
      agent: "Alex",
      hourFrom: 9,
      hourTo: 17,
      disposition: "answered",
      minTalkTime: 120,
    });
  });

  it("parseAnalyticsFilters swaps inverted hour range", () => {
    const f = parseAnalyticsFilters({ hourFrom: "20", hourTo: "6" });
    expect(f.hourFrom).toBe(6);
    expect(f.hourTo).toBe(20);
  });

  it("filterCanonicalRecords applies queue, agent, hour, disposition, minTalkTime", () => {
    const base = new Date("2026-04-01T09:30:00.000Z");
    const records = [
      {
        agentName: "A",
        queue: "Sales",
        dateTime: base,
        talkTime: 60,
        waitTime: 10,
        disposition: "answered",
      },
      {
        agentName: "B",
        queue: "Support",
        dateTime: base,
        talkTime: 200,
        waitTime: 10,
        disposition: "abandoned",
      },
      {
        agentName: "A",
        queue: "Sales",
        dateTime: new Date("2026-04-01T23:00:00.000Z"),
        talkTime: 360,
        waitTime: 10,
        disposition: "forwarded",
      },
    ];
    const f1 = filterCanonicalRecords(records, { queue: "Sales" });
    expect(f1).toHaveLength(2);
    const f2 = filterCanonicalRecords(records, { agent: "A", hourFrom: 0, hourTo: 12 }, "UTC");
    expect(f2).toHaveLength(1);
    const f3 = filterCanonicalRecords(records, { disposition: "abandoned", minTalkTime: 120 });
    expect(f3).toHaveLength(1);
    expect(f3[0]?.agentName).toBe("B");
  });

  it("filterCanonicalRecords hour range uses reporting time zone hours", () => {
    const records = [
      {
        agentName: "A",
        queue: "Sales",
        dateTime: new Date("2026-04-01T07:00:00.000Z"),
        talkTime: 60,
        waitTime: 10,
        disposition: "answered",
      },
    ];
    expect(
      filterCanonicalRecords(records, { hourFrom: 2, hourTo: 2 }, "America/Chicago"),
    ).toHaveLength(1);
    expect(filterCanonicalRecords(records, { hourFrom: 2, hourTo: 2 }, "UTC")).toHaveLength(0);
  });

  it("uniqueFieldValues returns sorted unique strings", () => {
    const records = [
      { agentName: "Zed", queue: "B" },
      { agentName: "Amy", queue: "A" },
      { agentName: "Amy", queue: "A" },
    ];
    expect(uniqueFieldValues(records, "agentName")).toEqual(["Amy", "Zed"]);
    expect(uniqueFieldValues(records, "queue")).toEqual(["A", "B"]);
  });
});
