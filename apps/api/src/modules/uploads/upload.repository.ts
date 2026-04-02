import type { Prisma, PrismaClient } from "@prisma/client";

export interface UploadEntity {
  id: string;
  userId: string;
  fileName: string;
  storagePath: string;
  rowCount: number;
  columnMap: Record<string, string>;
  status: string;
  uploadedAt: Date;
}

export interface IUploadRepository {
  create(data: {
    id: string;
    userId: string;
    fileName: string;
    storagePath: string;
    rowCount: number;
    columnMap: Record<string, string>;
    status: "PROCESSING" | "READY" | "ERROR";
  }): Promise<UploadEntity>;
  findByUserId(userId: string): Promise<UploadEntity[]>;
  findByIdAndUserId(id: string, userId: string): Promise<UploadEntity | null>;
  delete(id: string, userId: string): Promise<void>;
}

function mapUpload(row: {
  id: string;
  userId: string;
  fileName: string;
  storagePath: string;
  rowCount: number;
  columnMap: Prisma.JsonValue;
  status: string;
  uploadedAt: Date;
}): UploadEntity {
  const columnMap =
    typeof row.columnMap === "object" && row.columnMap !== null && !Array.isArray(row.columnMap)
      ? (row.columnMap as Record<string, string>)
      : {};
  return {
    id: row.id,
    userId: row.userId,
    fileName: row.fileName,
    storagePath: row.storagePath,
    rowCount: row.rowCount,
    columnMap,
    status: row.status,
    uploadedAt: row.uploadedAt,
  };
}

export class PrismaUploadRepository implements IUploadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    id: string;
    userId: string;
    fileName: string;
    storagePath: string;
    rowCount: number;
    columnMap: Record<string, string>;
    status: "PROCESSING" | "READY" | "ERROR";
  }): Promise<UploadEntity> {
    const row = await this.prisma.upload.create({
      data: {
        id: data.id,
        userId: data.userId,
        fileName: data.fileName,
        storagePath: data.storagePath,
        rowCount: data.rowCount,
        columnMap: data.columnMap as Prisma.InputJsonValue,
        status: data.status,
      },
    });
    return mapUpload(row);
  }

  async findByUserId(userId: string): Promise<UploadEntity[]> {
    const rows = await this.prisma.upload.findMany({
      where: { userId },
      orderBy: { uploadedAt: "desc" },
    });
    return rows.map(mapUpload);
  }

  async findByIdAndUserId(id: string, userId: string): Promise<UploadEntity | null> {
    const row = await this.prisma.upload.findFirst({
      where: { id, userId },
    });
    return row ? mapUpload(row) : null;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.prisma.upload.deleteMany({
      where: { id, userId },
    });
  }
}
