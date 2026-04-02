export function resolveReportingTimeZone(raw?: string | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return "UTC";
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return "UTC";
  }
}

export function getHourInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour");
  const hour = hourPart ? Number.parseInt(hourPart.value, 10) : Number.NaN;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid hour for time zone "${timeZone}"`);
  }
  return hour;
}

export function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    throw new Error(`Could not format calendar date for time zone "${timeZone}"`);
  }
  return `${y}-${m}-${d}`;
}
