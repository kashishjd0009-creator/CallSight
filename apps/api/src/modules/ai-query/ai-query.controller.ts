import type { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";

import { AppError } from "../../core/errors.js";
import { ok } from "../../core/http.js";
import type { BillingService } from "../billing/billing.service.js";
import { ObservabilityService } from "../observability/observability.service.js";
import { PipelineStep } from "../observability/pipeline-steps.js";
import { runProbe } from "../observability/pipeline-probe.js";
import type { ProbeContext } from "../observability/observability.types.js";
import { loadCanonicalRecordsForUpload } from "../uploads/load-upload-records.js";
import type { UploadTextStorage } from "../uploads/load-upload-records.js";
import { parseNaturalLanguageToQuery } from "./query-parser.gemini.js";
import type { ParsedQuery } from "./query.types.js";
import { parsedQuerySchema } from "./ai-query.validators.js";
import { AiQueryService } from "./ai-query.service.js";
import { AI_QUERY_USER_MESSAGES } from "./ai-query-user-messages.js";
import { classifyAiQueryParseFailure } from "./classify-ai-query-parse-failure.js";
import { normalizeParsedQueryForExecution } from "./normalize-parsed-query.js";

export class AiQueryController {
  constructor(
    private readonly aiQueryService: AiQueryService,
    private readonly prisma: PrismaClient,
    private readonly storage: UploadTextStorage,
    private readonly geminiApiKey: string,
    private readonly billingService: BillingService,
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

  query = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const userId = auth.userId;

    const uploadId = typeof req.params.uploadId === "string" ? req.params.uploadId : "";
    if (!uploadId) {
      throw new AppError(422, "VALIDATION_ERROR", "uploadId is required");
    }

    const body = req.body as { query: string };
    const ctx = this.probeCtx(req, uploadId);

    const loaded = await runProbe(
      this.observability,
      ctx,
      PipelineStep.LOAD_CSV_FOR_UPLOAD,
      () => loadCanonicalRecordsForUpload(this.prisma, this.storage, userId, uploadId),
      (l) =>
        l
          ? { recordCount: l.records.length, columnMapKeys: Object.keys(l.columnMap).length }
          : { found: false },
    );
    if (!loaded) {
      throw new AppError(404, "NOT_FOUND", "Upload not found");
    }

    let parsed: ParsedQuery;
    try {
      const raw = await parseNaturalLanguageToQuery(this.geminiApiKey, body.query, {
        observability: this.observability,
        ctx,
        systemPromptVersion: "query-parser-v1",
      });
      const validated = parsedQuerySchema.safeParse(raw);
      if (!validated.success) {
        throw new Error("PARSED_QUERY_INVALID");
      }
      parsed = normalizeParsedQueryForExecution(validated.data as ParsedQuery);
    } catch (e) {
      if (e instanceof Error && e.message === "UNSUPPORTED_QUERY") {
        throw new AppError(400, "UNSUPPORTED_QUERY", AI_QUERY_USER_MESSAGES.unsupported);
      }
      if (e instanceof Error && e.message === "PARSED_QUERY_INVALID") {
        throw new AppError(422, "PARSE_ERROR", AI_QUERY_USER_MESSAGES.schemaInvalid);
      }
      const technical =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      console.error("[AI_QUERY] Natural language parse failed", {
        correlationId: req.correlationId,
        uploadId,
        userId,
        error: technical,
        stack: e instanceof Error ? e.stack : undefined,
      });
      const classified = classifyAiQueryParseFailure(e);
      throw new AppError(classified.httpStatus, classified.code, classified.publicMessage);
    }

    const output = await runProbe(
      this.observability,
      ctx,
      PipelineStep.AI_QUERY_EXECUTE,
      () => this.aiQueryService.executeForUser(userId, parsed, loaded.records),
      (o) =>
        o.blocked
          ? { blocked: true, remaining: o.allowance.remaining }
          : {
              blocked: false,
              metric: parsed.metric,
              valueKind: Array.isArray(o.result.value) ? "series" : "scalar",
            },
    );
    if (output.blocked) {
      res.setHeader("X-Queries-Remaining", `${output.allowance.remaining ?? 0}`);
      throw new AppError(429, "QUERY_LIMIT_REACHED", "Monthly query limit reached", {
        upgradeUrl: "/pricing",
      });
    }

    await runProbe(
      this.observability,
      ctx,
      PipelineStep.AI_REPORT_PERSIST,
      () =>
        this.prisma.report.create({
          data: {
            userId,
            uploadId,
            type: "AI_QUERY",
            query: body.query,
            parsedQuery: parsed as object,
            resultData: output.result as object,
          },
        }),
      (r) => ({ reportId: r.id }),
    );

    const rem = output.allowance.remaining;
    res.setHeader("X-Queries-Remaining", rem === null ? "999999" : `${rem}`);
    ok(res, output.result);
  };

  history = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const uploadId = typeof req.params.uploadId === "string" ? req.params.uploadId : "";
    if (!uploadId) {
      throw new AppError(422, "VALIDATION_ERROR", "uploadId is required");
    }

    const rows = await this.prisma.report.findMany({
      where: { userId: auth.userId, uploadId, type: "AI_QUERY" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        query: true,
        parsedQuery: true,
        resultData: true,
        createdAt: true,
      },
    });
    ok(res, rows);
  };

  usage = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const snapshot = await this.billingService.getUserSnapshot(auth.userId);
    const allowance = this.billingService.checkQueryAllowed(snapshot);
    ok(res, {
      used: snapshot.aiQueryCount,
      limit: allowance.limit,
      remaining: allowance.remaining,
    });
  };
}
