import { describe, expect, it } from "vitest";

import { AppError } from "../../../core/errors.js";
import type { IObservabilityRepository } from "../observability.repository.js";
import { ObservabilityService } from "../observability.service.js";
import { PipelineStep } from "../pipeline-steps.js";
import { runProbe } from "../pipeline-probe.js";
import { createTerminalLogger } from "../terminal-logger.js";

describe("runProbe", () => {
  it("records before and after with non-negative duration and same probeSpanId", async () => {
    const rows: { phase: string; durationMs?: number | null; probeSpanId?: string | null }[] = [];
    const repo: IObservabilityRepository = {
      async create(data) {
        rows.push({
          phase: data.phase,
          durationMs: data.durationMs,
          probeSpanId: data.probeSpanId,
        });
      },
      async findForProbeViewer() {
        return { rows: [], total: 0 };
      },
    };
    const obs = new ObservabilityService(repo, createTerminalLogger("silent"));
    const ctx = { correlationId: "cid", userId: "u1" };
    const result = await runProbe(
      obs,
      ctx,
      PipelineStep.UPLOAD_VALIDATE,
      async () => "ok",
      () => ({
        done: true,
      }),
    );
    expect(result).toBe("ok");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.phase).toBe("before");
    expect(rows[1]?.phase).toBe("after");
    expect(rows[1]?.durationMs ?? 0).toBeGreaterThanOrEqual(0);
    expect(rows[0]?.probeSpanId).toBeTruthy();
    expect(rows[0]?.probeSpanId).toBe(rows[1]?.probeSpanId);
  });

  it("records error phase on AppError with same probeSpanId", async () => {
    const rows: { phase: string; errorCode?: string | null; probeSpanId?: string | null }[] = [];
    const repo: IObservabilityRepository = {
      async create(data) {
        rows.push({ phase: data.phase, errorCode: data.errorCode, probeSpanId: data.probeSpanId });
      },
      async findForProbeViewer() {
        return { rows: [], total: 0 };
      },
    };
    const obs = new ObservabilityService(repo, createTerminalLogger("silent"));
    const ctx = { correlationId: "cid" };
    await expect(
      runProbe(obs, ctx, PipelineStep.AI_QUERY_EXECUTE, async () => {
        throw new AppError(400, "BAD", "nope");
      }),
    ).rejects.toThrow("nope");
    const before = rows.find((r) => r.phase === "before");
    const err = rows.find((r) => r.phase === "error");
    expect(before?.probeSpanId).toBeTruthy();
    expect(before?.probeSpanId).toBe(err?.probeSpanId);
    expect(err?.errorCode).toBe("BAD");
  });
});
