import type { PrismaClient } from "@prisma/client";

import type { CanonicalCallRecord } from "../analytics/analytics.types.js";
import { resolveReportingTimeZone } from "../analytics/reporting-timezone.js";

import { parseCsvToCanonicalRecords } from "./csv-to-records.js";
import type { LocalStorageProvider } from "./local-storage.provider.js";

export type UploadTextStorage = Pick<LocalStorageProvider, "readText">;

export async function loadCanonicalRecordsForUpload(
  prisma: PrismaClient,
  storage: UploadTextStorage,
  userId: string,
  uploadId: string,
): Promise<{ records: CanonicalCallRecord[]; columnMap: Record<string, string> } | null> {
  const upload = await prisma.upload.findFirst({
    where: { id: uploadId, userId },
  });
  if (!upload) {
    return null;
  }

  const columnMap =
    typeof upload.columnMap === "object" &&
    upload.columnMap !== null &&
    !Array.isArray(upload.columnMap)
      ? (upload.columnMap as Record<string, string>)
      : {};

  const csvContent = await storage.readText(upload.storagePath);
  const ingestTimeZone = resolveReportingTimeZone(process.env.ANALYTICS_TIMEZONE);
  const records = parseCsvToCanonicalRecords(csvContent, columnMap, ingestTimeZone);
  return { records, columnMap };
}
