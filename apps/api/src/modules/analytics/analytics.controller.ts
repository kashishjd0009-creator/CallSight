import type { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";

import { AppError } from "../../core/errors.js";
import { ok } from "../../core/http.js";
import type { ObservabilityService } from "../observability/observability.service.js";
import { PipelineStep } from "../observability/pipeline-steps.js";
import { runProbe } from "../observability/pipeline-probe.js";
import type { ProbeContext } from "../observability/observability.types.js";
import type { UploadTextStorage } from "../uploads/load-upload-records.js";
import { loadCanonicalRecordsForUpload } from "../uploads/load-upload-records.js";
import { type CompareMeasure, compareByDimension } from "./compare-metrics.js";
import { compareTimeSeriesByDimension } from "./compare-time-series.js";
import { parseAgentLeaderboardSort } from "./agent-leaderboard-query.js";
import { sortAgentPerformanceRows } from "./agent-performance-sort.js";
import {
  filterCanonicalRecords,
  parseAnalyticsFilters,
  uniqueFieldValues,
} from "./analytics.filters.js";
import { AnalyticsService } from "./analytics.service.js";
import { resolveReportingTimeZone } from "./reporting-timezone.js";
import { analyticsCompareBodySchema } from "./analytics.validators.js";

export class AnalyticsController {
  private readonly reportingTimeZone = resolveReportingTimeZone(process.env.ANALYTICS_TIMEZONE);
  private readonly analyticsService = new AnalyticsService(this.reportingTimeZone);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: UploadTextStorage,
    private readonly observability: ObservabilityService,
  ) {}

  private probeCtx(req: Request, uploadId: string): ProbeContext {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    return {
      correlationId: req.correlationId,
      userId: auth?.userId,
      uploadId,
      httpMethod: req.method,
      httpPath: req.originalUrl?.split("?")[0],
    };
  }

  dashboard = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const userId = auth.userId;
    const uploadId = typeof req.params.uploadId === "string" ? req.params.uploadId : "";
    if (!uploadId) {
      throw new AppError(422, "VALIDATION_ERROR", "uploadId is required");
    }
    const ctx = this.probeCtx(req, uploadId);

    const loaded = await runProbe(
      this.observability,
      ctx,
      PipelineStep.LOAD_CSV_FOR_UPLOAD,
      () => loadCanonicalRecordsForUpload(this.prisma, this.storage, userId, uploadId),
      (l) => (l ? { recordCount: l.records.length } : { found: false }),
    );
    if (!loaded) {
      throw new AppError(404, "NOT_FOUND", "Upload not found");
    }

    const allRecords = loaded.records;
    const filters = parseAnalyticsFilters(req.query);
    const filtered = await runProbe(
      this.observability,
      ctx,
      PipelineStep.ANALYTICS_FILTER,
      async () => filterCanonicalRecords(allRecords, filters, this.reportingTimeZone),
      (rows) => ({ filteredCount: rows.length }),
    );
    const dashboard = await runProbe(
      this.observability,
      ctx,
      PipelineStep.ANALYTICS_COMPUTE,
      async () => this.analyticsService.computeDashboard(filtered),
      (d) => ({ totalCalls: d.kpis.totalCalls }),
    );
    ok(res, {
      meta: {
        queues: uniqueFieldValues(allRecords, "queue"),
        agents: uniqueFieldValues(allRecords, "agentName"),
        reportingTimeZone: this.reportingTimeZone,
      },
      ...dashboard,
    });
  };

  agents = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const userId = auth.userId;
    const uploadId = typeof req.params.uploadId === "string" ? req.params.uploadId : "";
    if (!uploadId) {
      throw new AppError(422, "VALIDATION_ERROR", "uploadId is required");
    }
    const ctx = this.probeCtx(req, uploadId);

    const loaded = await runProbe(
      this.observability,
      ctx,
      PipelineStep.LOAD_CSV_FOR_UPLOAD,
      () => loadCanonicalRecordsForUpload(this.prisma, this.storage, userId, uploadId),
      (l) => (l ? { recordCount: l.records.length } : { found: false }),
    );
    if (!loaded) {
      throw new AppError(404, "NOT_FOUND", "Upload not found");
    }
    const filters = parseAnalyticsFilters(req.query);
    const filtered = await runProbe(
      this.observability,
      ctx,
      PipelineStep.ANALYTICS_FILTER,
      async () => filterCanonicalRecords(loaded.records, filters, this.reportingTimeZone),
      (rows) => ({ filteredCount: rows.length }),
    );
    const dashboard = await runProbe(
      this.observability,
      ctx,
      PipelineStep.ANALYTICS_COMPUTE,
      async () => this.analyticsService.computeDashboard(filtered),
      (d) => ({ totalCalls: d.kpis.totalCalls }),
    );
    const sortParams = parseAgentLeaderboardSort(req.query);
    if (!sortParams) {
      throw new AppError(422, "VALIDATION_ERROR", "Invalid leaderboard sort parameters");
    }
    const rows = sortAgentPerformanceRows(
      dashboard.charts.agentPerformance,
      sortParams.sortBy,
      sortParams.order,
    );
    ok(res, rows);
  };

  /**
   * Multi-select agent or queue comparison for dashboard (no LLM).
   * Uses the same query-string filters as GET dashboard (queue, agent, disposition, minTalkTime, hour range).
   */
  compare = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const userId = auth.userId;
    const uploadId = typeof req.params.uploadId === "string" ? req.params.uploadId : "";
    if (!uploadId) {
      throw new AppError(422, "VALIDATION_ERROR", "uploadId is required");
    }
    const parsedBody = analyticsCompareBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new AppError(422, "VALIDATION_ERROR", "Invalid compare body");
    }
    const ctx = this.probeCtx(req, uploadId);

    const loaded = await runProbe(
      this.observability,
      ctx,
      PipelineStep.LOAD_CSV_FOR_UPLOAD,
      () => loadCanonicalRecordsForUpload(this.prisma, this.storage, userId, uploadId),
      (l) => (l ? { recordCount: l.records.length } : { found: false }),
    );
    if (!loaded) {
      throw new AppError(404, "NOT_FOUND", "Upload not found");
    }

    const filters = parseAnalyticsFilters(req.query);
    const filtered = await runProbe(
      this.observability,
      ctx,
      PipelineStep.ANALYTICS_FILTER,
      async () => filterCanonicalRecords(loaded.records, filters, this.reportingTimeZone),
      (rows) => ({ filteredCount: rows.length }),
    );

    const body = parsedBody.data;
    if (body.mode === "time_series") {
      const result = compareTimeSeriesByDimension(
        filtered,
        body.dimension,
        body.names,
        body.column,
        body.bucket,
        this.reportingTimeZone,
      );
      ok(res, result);
      return;
    }
    const result = compareByDimension(
      filtered,
      body.dimension,
      body.names,
      body.measure as CompareMeasure,
      this.reportingTimeZone,
    );
    ok(res, result);
  };
}
