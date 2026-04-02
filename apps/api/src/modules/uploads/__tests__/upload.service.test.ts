import { describe, expect, it } from "vitest";

import { UploadService } from "../upload.service.js";
import type { UploadFile } from "../upload.types.js";

function makeCsv(rows: number): string {
  const lines = ["agent,talk_time"];
  for (let i = 0; i < rows; i += 1) {
    lines.push(`Agent ${i},30`);
  }
  return lines.join("\n");
}

function createFile(rows: number, bytesOverride?: number): UploadFile {
  const content = makeCsv(rows);
  return {
    originalName: "calls.csv",
    content,
    sizeBytes: bytesOverride ?? Buffer.byteLength(content),
  };
}

describe("UploadService", () => {
  const service = new UploadService();

  it("allows free tier file within size and row limits", () => {
    const file = createFile(100);
    const result = service.validateCsvForTier(file, "FREE");
    expect(result.rowCount).toBe(100);
  });

  it("rejects free tier file when size exceeds 5MB", () => {
    const file = createFile(1, 5 * 1024 * 1024 + 1);
    expect(() => service.validateCsvForTier(file, "FREE")).toThrowError("UPLOAD_TOO_LARGE");
  });

  it("rejects free tier file when row count exceeds 10k", () => {
    const file = createFile(10_001, 1024);
    expect(() => service.validateCsvForTier(file, "FREE")).toThrowError("ROW_LIMIT_EXCEEDED");
  });

  it("allows pro tier up to 500k rows", () => {
    const file = createFile(500_000, 1024);
    const result = service.validateCsvForTier(file, "PRO");
    expect(result.rowCount).toBe(500_000);
  });
});
