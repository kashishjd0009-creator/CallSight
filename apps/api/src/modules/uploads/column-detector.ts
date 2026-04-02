import { closest, distance } from "fastest-levenshtein";

export type CanonicalColumn =
  | "callId"
  | "queue"
  | "agentName"
  | "dateTime"
  | "answeredAt"
  | "extension"
  | "callerPhone"
  | "disposition"
  | "talkTime"
  | "waitTime"
  | "customTag";

export type ColumnMap = Partial<Record<CanonicalColumn, string>>;

const exactDictionary: Record<CanonicalColumn, string[]> = {
  agentName: ["Agent Name", "agent_name", "Agent", "Representative", "CSR Name", "Rep"],
  talkTime: ["Talk Time", "talk_time", "Handle Time", "Duration", "Call Duration"],
  waitTime: ["Wait Time", "wait_time", "Hold Time", "Queue Time", "Ring Time"],
  queue: ["Call Queue", "Queue", "queue_name", "Department", "Group"],
  dateTime: ["Date/Time", "datetime", "Call Date", "Timestamp", "Start Time"],
  answeredAt: ["Answered Date/Time", "Answer Time", "answered_at"],
  disposition: ["Disposition", "Status", "Call Result", "Outcome", "Call Status"],
  callId: ["Call ID", "call_id", "CallId", "ID", "Unique ID"],
  extension: ["Extension", "Ext", "ext", "Agent Extension"],
  callerPhone: ["From", "Caller", "Phone", "Caller ID", "ANI"],
  customTag: ["Custom Tag", "Tag", "Label", "custom_tag"],
};

const normalizedToCanonical = new Map<string, CanonicalColumn>();
for (const [canonical, aliases] of Object.entries(exactDictionary) as [
  CanonicalColumn,
  string[],
][]) {
  for (const alias of aliases) {
    normalizedToCanonical.set(normalize(alias), canonical);
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 1;
  }
  const levenshteinDistance = distance(a, b);
  return 1 - levenshteinDistance / maxLen;
}

export class ColumnDetector {
  detect(headers: string[]): ColumnMap {
    const map: ColumnMap = {};

    for (const header of headers) {
      const normalized = normalize(header);

      const exact = normalizedToCanonical.get(normalized);
      if (exact && !map[exact]) {
        map[exact] = header;
        continue;
      }

      const aliases = Array.from(normalizedToCanonical.keys());
      const candidate = closest(normalized, aliases);
      if (!candidate) {
        continue;
      }

      const canonical = normalizedToCanonical.get(candidate);
      if (!canonical || map[canonical]) {
        continue;
      }

      const score = similarity(normalized, candidate);
      if (score > 0.75) {
        map[canonical] = header;
        console.warn(
          `ColumnDetector fuzzy-matched "${header}" to "${canonical}" with score ${score.toFixed(2)}`,
        );
      }
    }

    return map;
  }
}
