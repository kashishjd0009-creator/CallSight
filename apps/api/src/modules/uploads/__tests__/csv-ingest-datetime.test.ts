import { describe, expect, it } from "vitest";

import { parseIngestDateTime } from "../csv-ingest-datetime.js";

describe("parseIngestDateTime", () => {
  it("interprets MM/DD/YYYY h:mm:ss AM/PM as wall time in the given IANA zone (EDT example)", () => {
    const d = parseIngestDateTime("03/31/2026 02:14:32 PM", "America/New_York");
    expect(d?.toISOString()).toBe("2026-03-31T18:14:32.000Z");
  });

  it("uses UTC when ingest zone is UTC (same digits, different instant)", () => {
    const d = parseIngestDateTime("03/31/2026 02:14:32 PM", "UTC");
    expect(d?.toISOString()).toBe("2026-03-31T14:14:32.000Z");
  });

  it("returns undefined for nonexistent local time on US spring-forward", () => {
    expect(parseIngestDateTime("03/08/2026 02:30:00 AM", "America/New_York")).toBeUndefined();
  });

  it("parses ISO instants with explicit Z without using server local semantics", () => {
    const d = parseIngestDateTime("2026-03-31T18:14:32.000Z", "America/New_York");
    expect(d?.toISOString()).toBe("2026-03-31T18:14:32.000Z");
  });

  it("returns undefined for empty or unparseable values", () => {
    expect(parseIngestDateTime("", "America/New_York")).toBeUndefined();
    expect(parseIngestDateTime("not a date", "America/New_York")).toBeUndefined();
  });
});
