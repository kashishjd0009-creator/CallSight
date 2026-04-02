import { describe, expect, it } from "vitest";

import {
  formatDateKeyInTimeZone,
  getHourInTimeZone,
  resolveReportingTimeZone,
} from "../reporting-timezone.js";

describe("reporting-timezone", () => {
  it("resolveReportingTimeZone returns UTC when unset or blank", () => {
    expect(resolveReportingTimeZone(undefined)).toBe("UTC");
    expect(resolveReportingTimeZone("")).toBe("UTC");
    expect(resolveReportingTimeZone("   ")).toBe("UTC");
  });

  it("resolveReportingTimeZone returns the IANA id when valid", () => {
    expect(resolveReportingTimeZone("America/Chicago")).toBe("America/Chicago");
    expect(resolveReportingTimeZone(" Europe/Paris ")).toBe("Europe/Paris");
  });

  it("resolveReportingTimeZone falls back to UTC for invalid zone strings", () => {
    expect(resolveReportingTimeZone("Not/AZone")).toBe("UTC");
  });

  it("getHourInTimeZone returns 0–23 using hourCycle h23", () => {
    const midnightUtc = new Date("2026-01-01T00:00:00.000Z");
    expect(getHourInTimeZone(midnightUtc, "UTC")).toBe(0);
    expect(getHourInTimeZone(new Date("2026-01-01T23:30:00.000Z"), "UTC")).toBe(23);
  });

  it("getHourInTimeZone maps the same instant differently for Chicago vs UTC (CDT April)", () => {
    const instant = new Date("2026-04-01T07:00:00.000Z");
    expect(getHourInTimeZone(instant, "UTC")).toBe(7);
    expect(getHourInTimeZone(instant, "America/Chicago")).toBe(2);
  });

  it("formatDateKeyInTimeZone uses the reporting calendar date", () => {
    const utcAheadOfChicagoDate = new Date("2026-04-01T04:30:00.000Z");
    expect(formatDateKeyInTimeZone(utcAheadOfChicagoDate, "UTC")).toBe("2026-04-01");
    expect(formatDateKeyInTimeZone(utcAheadOfChicagoDate, "America/Chicago")).toBe("2026-03-31");
  });
});
