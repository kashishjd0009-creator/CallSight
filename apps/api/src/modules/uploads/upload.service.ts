import type { Tier, UploadFile } from "./upload.types.js";

interface UploadValidationResult {
  rowCount: number;
}

const tierLimits: Record<Tier, { maxBytes: number; maxRows: number }> = {
  FREE: { maxBytes: 5 * 1024 * 1024, maxRows: 10_000 },
  PRO: { maxBytes: 50 * 1024 * 1024, maxRows: 500_000 },
  PREMIUM: { maxBytes: 200 * 1024 * 1024, maxRows: Number.MAX_SAFE_INTEGER },
};

export class UploadService {
  validateCsvForTier(file: UploadFile, tier: Tier): UploadValidationResult {
    const limits = tierLimits[tier];
    if (file.sizeBytes > limits.maxBytes) {
      throw new Error("UPLOAD_TOO_LARGE");
    }

    const rowCount = this.countRows(file.content);
    if (rowCount > limits.maxRows) {
      throw new Error("ROW_LIMIT_EXCEEDED");
    }

    return { rowCount };
  }

  private countRows(csvContent: string): number {
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length <= 1) {
      return 0;
    }
    return lines.length - 1;
  }
}
