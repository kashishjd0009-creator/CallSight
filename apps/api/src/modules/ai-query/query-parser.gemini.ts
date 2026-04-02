import { randomUUID } from "node:crypto";

import { createGeminiModel } from "./gemini.client.js";
import type { ObservabilityService } from "../observability/observability.service.js";
import { shortPromptHash } from "../observability/prompt-hash.js";
import { PipelineStep } from "../observability/pipeline-steps.js";
import type { ProbeContext } from "../observability/observability.types.js";
import { QUERY_PARSER_SYSTEM_PROMPT } from "./prompts/query-parser.prompt.js";
import type { ParsedQuery } from "./query.types.js";

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  return trimmed;
}

export type GeminiParseProbeOptions = {
  observability: ObservabilityService;
  ctx: ProbeContext;
  systemPromptVersion: string;
};

export async function parseNaturalLanguageToQuery(
  apiKey: string,
  question: string,
  probe?: GeminiParseProbeOptions,
): Promise<ParsedQuery> {
  const model = createGeminiModel(apiKey);
  const prompt = `${QUERY_PARSER_SYSTEM_PROMPT}

User question: ${question}

Return ONLY valid JSON, no markdown.`;

  const promptHash = shortPromptHash(QUERY_PARSER_SYSTEM_PROMPT);
  const t0 = Date.now();
  /** One span id for before/after/error so probe viewer includes Gemini rows (it filters on probeSpanId). */
  const geminiProbeSpanId = probe ? randomUUID() : null;
  if (probe && geminiProbeSpanId) {
    await probe.observability.record({
      probeSpanId: geminiProbeSpanId,
      correlationId: probe.ctx.correlationId,
      userId: probe.ctx.userId,
      uploadId: probe.ctx.uploadId,
      step: PipelineStep.AI_GEMINI_PARSE,
      phase: "before",
      level: "info",
      httpMethod: probe.ctx.httpMethod ?? undefined,
      httpPath: probe.ctx.httpPath ?? undefined,
      payload: {
        systemPromptVersion: probe.systemPromptVersion,
        promptHash,
        model: "gemini-2.5-flash",
        totalPromptChars: prompt.length,
        /** Exact NL question from the user (same as request body `query`). */
        userQuery: question,
        /**
         * Full system prompt describing metrics/columns — the only “data shape” text sent to the model.
         * CallSight does not send CSV rows or cell samples to Gemini (see master prompt).
         */
        dataSchemaPrompt: QUERY_PARSER_SYSTEM_PROMPT,
        noCsvRowsSentToModel: true,
      },
    });
  }

  let responseChars = 0;
  let rawText = "";
  try {
    const result = await model.generateContent(prompt);
    rawText = result.response.text();
    responseChars = rawText.length;
    const jsonText = extractJson(rawText);
    const parsed = JSON.parse(jsonText) as ParsedQuery & { error?: string };

    if (
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      parsed.error === "UNSUPPORTED_QUERY"
    ) {
      throw new Error("UNSUPPORTED_QUERY");
    }

    if (probe && geminiProbeSpanId) {
      const durationMs = Date.now() - t0;
      await probe.observability.record({
        probeSpanId: geminiProbeSpanId,
        correlationId: probe.ctx.correlationId,
        userId: probe.ctx.userId,
        uploadId: probe.ctx.uploadId,
        step: PipelineStep.AI_GEMINI_PARSE,
        phase: "after",
        level: "info",
        durationMs,
        httpMethod: probe.ctx.httpMethod ?? undefined,
        httpPath: probe.ctx.httpPath ?? undefined,
        payload: {
          responseChars,
          parsedOk: true,
          metric: (parsed as ParsedQuery).metric,
          /** Raw text returned by Gemini (JSON or fenced); not post-processed. */
          rawModelOutput: rawText,
        },
      });
    }

    return parsed as ParsedQuery;
  } catch (e) {
    if (probe && geminiProbeSpanId) {
      const durationMs = Date.now() - t0;
      const code =
        e instanceof Error && e.message === "UNSUPPORTED_QUERY"
          ? "UNSUPPORTED_QUERY"
          : "PARSE_ERROR";
      await probe.observability.record({
        probeSpanId: geminiProbeSpanId,
        correlationId: probe.ctx.correlationId,
        userId: probe.ctx.userId,
        uploadId: probe.ctx.uploadId,
        step: PipelineStep.AI_GEMINI_PARSE,
        phase: "error",
        level: "error",
        durationMs,
        errorCode: code,
        httpMethod: probe.ctx.httpMethod ?? undefined,
        httpPath: probe.ctx.httpPath ?? undefined,
        payload: {
          responseChars,
          parsedOk: false,
          ...(rawText ? { rawModelOutput: rawText } : {}),
        },
      });
    }
    throw e;
  }
}
