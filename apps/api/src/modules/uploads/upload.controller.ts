import type { Request, Response } from "express";

import { AppError } from "../../core/errors.js";
import { ok } from "../../core/http.js";
import type { ObservabilityService } from "../observability/observability.service.js";
import { PipelineStep } from "../observability/pipeline-steps.js";
import { runProbe } from "../observability/pipeline-probe.js";
import type { ProbeContext } from "../observability/observability.types.js";
import type { IUserRepository } from "../users/user.repository.js";
import { ColumnDetector } from "./column-detector.js";
import type { IUploadRepository } from "./upload.repository.js";
import type { LocalStorageProvider } from "./local-storage.provider.js";
import { splitCsvLine } from "./csv-to-records.js";
import { UploadService } from "./upload.service.js";

function publicUploadRow(upload: {
  id: string;
  userId: string;
  fileName: string;
  rowCount: number;
  columnMap: Record<string, string>;
  status: string;
  uploadedAt: Date;
}) {
  return {
    id: upload.id,
    userId: upload.userId,
    fileName: upload.fileName,
    rowCount: upload.rowCount,
    columnMap: upload.columnMap,
    status: upload.status,
    uploadedAt: upload.uploadedAt,
  };
}

export class UploadController {
  private readonly uploadService = new UploadService();
  private readonly columnDetector = new ColumnDetector();

  constructor(
    private readonly uploadRepository: IUploadRepository,
    private readonly storage: LocalStorageProvider,
    private readonly userRepository: IUserRepository,
    private readonly observability: ObservabilityService,
  ) {}

  private probeCtx(req: Request): ProbeContext {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    return {
      correlationId: req.correlationId,
      userId: auth?.userId,
      httpMethod: req.method,
      httpPath: req.originalUrl?.split("?")[0],
    };
  }

  createUpload = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const userId = auth.userId;

    const body = req.body as { fileName?: string; csvContent?: string; sizeBytes?: number };

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    if (!body.csvContent?.trim() || !body.fileName?.trim()) {
      throw new AppError(422, "VALIDATION_ERROR", "fileName and csvContent are required");
    }
    const csvContent = body.csvContent;
    const fileName = body.fileName.trim();
    const sizeBytes = body.sizeBytes ?? Buffer.byteLength(csvContent, "utf8");
    const tier = user.tier;
    const ctx = this.probeCtx(req);

    const validation = await runProbe(
      this.observability,
      ctx,
      PipelineStep.UPLOAD_VALIDATE,
      async () =>
        this.uploadService.validateCsvForTier(
          { originalName: fileName, sizeBytes, content: csvContent },
          tier,
        ),
      (v) => ({ rowCount: v.rowCount, sizeBytes, tier }),
    );

    const firstLine = csvContent.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
    const headers = firstLine ? splitCsvLine(firstLine) : [];
    const columnMap = await runProbe(
      this.observability,
      ctx,
      PipelineStep.UPLOAD_COLUMN_DETECT,
      async () => this.columnDetector.detect(headers),
      (m) => ({ mappedColumns: Object.keys(m).length }),
    );

    const id = crypto.randomUUID();
    const buffer = Buffer.from(csvContent, "utf8");
    const entity = await runProbe(
      this.observability,
      ctx,
      PipelineStep.UPLOAD_PERSIST,
      async () => {
        const storagePath = await this.storage.save(userId, id, buffer);
        const created = await this.uploadRepository.create({
          id,
          userId,
          fileName,
          storagePath,
          rowCount: validation.rowCount,
          columnMap,
          status: "READY",
        });
        return created;
      },
      (row) => ({
        uploadId: row.id,
        storagePathSuffix: row.storagePath.split("/").slice(-2).join("/"),
      }),
    );

    ok(res, publicUploadRow(entity), 201);
  };

  listUploads = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const rows = await this.uploadRepository.findByUserId(auth.userId);
    ok(res, rows.map(publicUploadRow));
  };

  getUpload = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const upload = await this.uploadRepository.findByIdAndUserId(id, auth.userId);
    ok(res, upload ? publicUploadRow(upload) : null);
  };

  deleteUpload = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const upload = await this.uploadRepository.findByIdAndUserId(id, auth.userId);
    if (upload) {
      await this.storage.delete(upload.storagePath);
      await this.uploadRepository.delete(id, auth.userId);
    }
    ok(res, { deleted: true });
  };
}
