import { describe, expect, it } from "vitest";

import { parseCsvToCanonicalRecords, splitCsvLine } from "../csv-to-records.js";

describe("parseCsvToCanonicalRecords", () => {
  const csv = [
    '"Call ID","Call Queue","Date/Time","Agent Name","Disposition","Talk Time","Wait Time"',
    '"abc-1","Sales - 427","03/31/2026 02:14:32 PM","Agent A","answered","00:01:05","00:00:10"',
  ].join("\n");

  it("resolves columnMap when stored headers still include CSV quote wrappers (legacy uploads)", () => {
    const columnMap: Record<string, string> = {
      callId: '"Call ID"',
      queue: '"Call Queue"',
      dateTime: '"Date/Time"',
      agentName: '"Agent Name"',
      disposition: '"Disposition"',
      talkTime: '"Talk Time"',
      waitTime: '"Wait Time"',
    };
    const records = parseCsvToCanonicalRecords(csv, columnMap, "America/New_York");
    expect(records).toHaveLength(1);
    expect(records[0]?.callId).toBe("abc-1");
    expect(records[0]?.queue).toBe("Sales - 427");
    expect(records[0]?.agentName).toBe("Agent A");
    expect(records[0]?.disposition).toBe("answered");
    expect(records[0]?.talkTime).toBe(65);
    expect(records[0]?.waitTime).toBe(10);
    expect(records[0]?.dateTime).toBeInstanceOf(Date);
    expect(records[0]?.dateTime?.toISOString()).toBe("2026-03-31T18:14:32.000Z");
  });

  it("resolves columnMap when stored headers match stripped header row", () => {
    const columnMap: Record<string, string> = {
      callId: "Call ID",
      queue: "Call Queue",
      dateTime: "Date/Time",
      agentName: "Agent Name",
      disposition: "Disposition",
      talkTime: "Talk Time",
      waitTime: "Wait Time",
    };
    const records = parseCsvToCanonicalRecords(csv, columnMap, "America/New_York");
    expect(records[0]?.callId).toBe("abc-1");
    expect(records[0]?.dateTime).toBeInstanceOf(Date);
    expect(records[0]?.dateTime?.toISOString()).toBe("2026-03-31T18:14:32.000Z");
  });

  it("uses UTC wall time when ingest timezone is UTC", () => {
    const columnMap: Record<string, string> = {
      callId: "Call ID",
      queue: "Call Queue",
      dateTime: "Date/Time",
      agentName: "Agent Name",
      disposition: "Disposition",
      talkTime: "Talk Time",
      waitTime: "Wait Time",
    };
    const records = parseCsvToCanonicalRecords(csv, columnMap, "UTC");
    expect(records[0]?.dateTime?.toISOString()).toBe("2026-03-31T14:14:32.000Z");
  });
});

describe("splitCsvLine", () => {
  it("strips surrounding quotes from each cell", () => {
    expect(splitCsvLine('"A","B","C"')).toEqual(["A", "B", "C"]);
  });
});
