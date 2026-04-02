import { describe, expect, it, vi } from "vitest";

import type { IObservabilityRepository } from "../observability.repository.js";
import { ObservabilityService } from "../observability.service.js";
import { PipelineStep } from "../pipeline-steps.js";
import { createTerminalLogger } from "../terminal-logger.js";
import type { TerminalLogger } from "../terminal-logger.js";

describe("ObservabilityService", () => {
  it("persists redacted payload and logs", async () => {
    const creates: unknown[] = [];
    const repo: IObservabilityRepository = {
      async create(data) {
        creates.push(data);
      },
      async findForProbeViewer() {
        return { rows: [], total: 0 };
      },
    };
    const logger = createTerminalLogger("silent");
    const obs = new ObservabilityService(repo, logger);
    await obs.record({
      probeSpanId: "span-redact-1",
      correlationId: "c1",
      step: PipelineStep.HTTP_REQUEST,
      phase: "after",
      level: "info",
      payload: { password: "x", ok: true },
    });
    expect(creates).toHaveLength(1);
    const row = creates[0] as { payload: { password: string } };
    expect(row.payload.password).toBe("[REDACTED]");
  });

  it("does not throw when persistence fails", async () => {
    const repo: IObservabilityRepository = {
      async create() {
        throw new Error("table missing");
      },
      async findForProbeViewer() {
        return { rows: [], total: 0 };
      },
    };
    const errorFn = vi.fn();
    const logger = {
      error: errorFn,
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as TerminalLogger;
    const obs = new ObservabilityService(repo, logger);
    await expect(
      obs.record({
        probeSpanId: "span-persist-fail",
        correlationId: "c2",
        step: PipelineStep.AUTH_LOGIN,
        phase: "before",
        level: "info",
      }),
    ).resolves.toBeUndefined();
    expect(errorFn).toHaveBeenCalled();
  });

  it("throws when probeSpanId is missing or blank", async () => {
    const repo: IObservabilityRepository = {
      async create() {},
      async findForProbeViewer() {
        return { rows: [], total: 0 };
      },
    };
    const obs = new ObservabilityService(repo, createTerminalLogger("silent"));
    await expect(
      obs.record({
        probeSpanId: "  ",
        correlationId: "c-blank",
        step: PipelineStep.AUTH_LOGIN,
        phase: "before",
        level: "info",
      }),
    ).rejects.toThrow(/probeSpanId/i);
  });

  it("recordHttpStart and recordHttpEnd persist the same probeSpanId", async () => {
    const creates: { probeSpanId?: string | null }[] = [];
    const repo: IObservabilityRepository = {
      async create(data) {
        creates.push({ probeSpanId: data.probeSpanId });
      },
      async findForProbeViewer() {
        return { rows: [], total: 0 };
      },
    };
    const obs = new ObservabilityService(repo, createTerminalLogger("silent"));
    await obs.recordHttpStart({
      correlationId: "c-h",
      httpMethod: "GET",
      httpPath: "/api/v1/x",
      probeSpanId: "http-span-99",
    });
    await obs.recordHttpEnd(
      {
        correlationId: "c-h",
        httpMethod: "GET",
        httpPath: "/api/v1/x",
        probeSpanId: "http-span-99",
      },
      200,
      3,
    );
    expect(creates).toHaveLength(2);
    expect(creates[0]?.probeSpanId).toBe("http-span-99");
    expect(creates[1]?.probeSpanId).toBe("http-span-99");
  });
});
