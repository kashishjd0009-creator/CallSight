import { DateTime } from "luxon";

/** MM/DD/YYYY h:mm:ss AM/PM — digits are wall time in `ingestTimeZone`, not the host OS zone. */
const US_DATE_TIME_AM_PM = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i;

function hasExplicitUtcOffset(trimmed: string): boolean {
  return /(Z|[+-][0-9]{2}(:?[0-9]{2})?)$/i.test(trimmed);
}

/**
 * Parse CSV datetime cells without using the server's local timezone.
 * - US-style values are interpreted as civil time in `ingestTimeZone` (DST-aware via Luxon).
 * - Strings with explicit Z or numeric offset are parsed as anchored instants.
 */
export function parseIngestDateTime(value: string, ingestTimeZone: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const matchUs = trimmed.match(US_DATE_TIME_AM_PM);
  if (matchUs) {
    const g1 = matchUs[1];
    const g2 = matchUs[2];
    const g3 = matchUs[3];
    const g4 = matchUs[4];
    const g5 = matchUs[5];
    const g6 = matchUs[6];
    const g7 = matchUs[7];
    if (!g1 || !g2 || !g3 || !g4 || !g5 || !g6 || !g7) {
      return undefined;
    }
    const month = Number(g1);
    const day = Number(g2);
    const year = Number(g3);
    let hour = Number(g4);
    const minute = Number(g5);
    const second = Number(g6);
    const meridiem = g7.toUpperCase();
    if (meridiem === "PM" && hour !== 12) {
      hour += 12;
    }
    if (meridiem === "AM" && hour === 12) {
      hour = 0;
    }
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
    ) {
      return undefined;
    }
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute, second },
      { zone: ingestTimeZone },
    );
    if (!dt.isValid) {
      return undefined;
    }
    const z = dt.setZone(ingestTimeZone);
    if (
      z.year !== year ||
      z.month !== month ||
      z.day !== day ||
      z.hour !== hour ||
      z.minute !== minute ||
      z.second !== second
    ) {
      return undefined;
    }
    return dt.toJSDate();
  }

  if (trimmed.includes("T") && hasExplicitUtcOffset(trimmed)) {
    const ms = Date.parse(trimmed);
    if (Number.isNaN(ms)) {
      return undefined;
    }
    return new Date(ms);
  }

  return undefined;
}
