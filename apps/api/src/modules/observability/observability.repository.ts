import type { Prisma, PrismaClient } from "@prisma/client";

import type { PipelineEventCreateInput } from "./observability.types.js";
import type { ProbeEventRow } from "./probe-viewer.mapper.js";

export type ProbeViewerQuery = {
  page: number;
  pageSize: number;
  search?: string;
  step?: string;
  sortDir: "asc" | "desc";
};

export type ProbeViewerQueryResult = {
  rows: ProbeEventRow[];
  total: number;
};

export interface IObservabilityRepository {
  create(data: PipelineEventCreateInput): Promise<void>;
  findForProbeViewer(query: ProbeViewerQuery): Promise<ProbeViewerQueryResult>;
}

export class PrismaObservabilityRepository implements IObservabilityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: PipelineEventCreateInput): Promise<void> {
    await this.prisma.pipelineEvent.create({
      data: {
        probeSpanId: data.probeSpanId,
        correlationId: data.correlationId,
        userId: data.userId ?? undefined,
        uploadId: data.uploadId ?? undefined,
        step: data.step,
        phase: data.phase,
        level: data.level,
        message: data.message ?? undefined,
        payload:
          data.payload === null || data.payload === undefined
            ? undefined
            : (data.payload as Prisma.InputJsonValue),
        durationMs: data.durationMs ?? undefined,
        httpMethod: data.httpMethod ?? undefined,
        httpPath: data.httpPath ?? undefined,
        statusCode: data.statusCode ?? undefined,
        errorCode: data.errorCode ?? undefined,
      },
    });
  }

  async findForProbeViewer(query: ProbeViewerQuery): Promise<ProbeViewerQueryResult> {
    const skip = (query.page - 1) * query.pageSize;
    const search = query.search?.trim();
    const where: Prisma.PipelineEventWhereInput = {
      ...(query.step ? { step: query.step } : {}),
      ...(search
        ? {
            OR: [
              { correlationId: { contains: search, mode: "insensitive" } },
              { userId: { contains: search, mode: "insensitive" } },
              { step: { contains: search, mode: "insensitive" } },
              { message: { contains: search, mode: "insensitive" } },
              { httpPath: { contains: search, mode: "insensitive" } },
              { errorCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [allGroups, pageGroups] = await Promise.all([
      this.prisma.pipelineEvent.groupBy({
        by: ["probeSpanId"],
        where,
      }),
      this.prisma.pipelineEvent.groupBy({
        by: ["probeSpanId"],
        where,
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: query.sortDir } },
        skip,
        take: query.pageSize,
      }),
    ]);
    const total = allGroups.length;
    const spanIds = pageGroups.map((g) => g.probeSpanId);
    if (spanIds.length === 0) {
      return { total, rows: [] };
    }
    const rows = await this.prisma.pipelineEvent.findMany({
      where: { probeSpanId: { in: spanIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        probeSpanId: true,
        correlationId: true,
        userId: true,
        step: true,
        phase: true,
        level: true,
        message: true,
        payload: true,
        durationMs: true,
        statusCode: true,
        errorCode: true,
        createdAt: true,
      },
    });
    return {
      total,
      rows: rows.map((row) => ({
        ...row,
        phase: row.phase as "before" | "after" | "error",
      })),
    };
  }
}
