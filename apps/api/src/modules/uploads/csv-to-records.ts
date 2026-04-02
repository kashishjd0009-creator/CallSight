import type { CanonicalCallRecord } from "../analytics/analytics.types.js";

import { parseIngestDateTime } from "./csv-ingest-datetime.js";
import { parseTimeToSeconds } from "./time-parser.js";

/** Splits a single CSV line on commas and strips RFC4180-style quotes from each cell. */
export function splitCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function normalizeMappedHeaderLabel(label: string): string {
  return label.trim().replace(/^"|"$/g, "");
}

/**
 * columnMap: canonical field name -> original CSV header label (from ColumnDetector).
 * ingestTimeZone: IANA id for zoneless US-style datetimes (same source as `ANALYTICS_TIMEZONE`).
 */
export function parseCsvToCanonicalRecords(
  csvContent: string,
  columnMap: Record<string, string>,
  ingestTimeZone = "UTC",
): CanonicalCallRecord[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0] ?? "");
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  const colIndex: Record<string, number> = {};
  for (const [canonical, headerName] of Object.entries(columnMap)) {
    const index = headerIndex.get(normalizeMappedHeaderLabel(headerName));
    if (index !== undefined) {
      colIndex[canonical] = index;
    }
  }

  const records: CanonicalCallRecord[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitCsvLine(lines[lineIndex] ?? "");
    const get = (canonical: string): string | undefined => {
      const index = colIndex[canonical];
      if (index === undefined) {
        return undefined;
      }
      return cells[index]?.trim();
    };

    const agentName = get("agentName");
    const queue = get("queue");
    const talkRaw = get("talkTime");
    const waitRaw = get("waitTime");
    const dateRaw = get("dateTime");
    const answeredRaw = get("answeredAt");
    const disposition = get("disposition");
    const callId = get("callId");
    const extension = get("extension");
    const callerPhone = get("callerPhone");
    const customTag = get("customTag");

    const talkTime = talkRaw ? parseTimeToSeconds(talkRaw) : undefined;
    const waitTime = waitRaw ? parseTimeToSeconds(waitRaw) : undefined;

    records.push({
      callId,
      queue,
      agentName,
      dateTime: dateRaw ? parseIngestDateTime(dateRaw, ingestTimeZone) : undefined,
      answeredAt: answeredRaw ? parseIngestDateTime(answeredRaw, ingestTimeZone) : undefined,
      extension,
      callerPhone,
      disposition,
      talkTime,
      waitTime,
      customTag,
    });
  }

  return records;
}
