/**
 * Shared disposition normalization for dashboard, AI query metrics, and B-rules.
 * Keep in sync with answered / abandoned semantics used in AnalyticsService.
 */
export function normalizeDisposition(
  value: string | undefined,
): "answered" | "abandoned" | "forwarded" | "other" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "answered") {
    return "answered";
  }
  if (normalized === "abandoned") {
    return "abandoned";
  }
  if (normalized === "forwarded") {
    return "forwarded";
  }
  return "other";
}

export function isAnsweredDisposition(disposition: string | undefined): boolean {
  return normalizeDisposition(disposition) === "answered";
}

/** B5 — transfer / forward detection via disposition string (not telephony signaling). */
export const TRANSFER_DISPOSITION_EXACT = new Set(["transfer", "transferred", "transferred out"]);

export function isTransferDisposition(disposition: string | undefined): boolean {
  const t = disposition?.trim().toLowerCase() ?? "";
  if (t.length === 0) {
    return false;
  }
  if (TRANSFER_DISPOSITION_EXACT.has(t)) {
    return true;
  }
  return t.includes("transfer");
}
