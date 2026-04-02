import { describe, expect, it, vi } from "vitest";

import type { IBillingRepository } from "../billing.repository.js";
import { BillingService } from "../billing.service.js";

function buildRepositoryMock(): IBillingRepository {
  return {
    getUserTier: vi.fn(),
    getUsageRecord: vi.fn(),
    upsertUsageRecord: vi.fn(),
    incrementUsage: vi.fn(),
  };
}

describe("BillingService", () => {
  it("allows PRO user at 29 queries", () => {
    const service = new BillingService(buildRepositoryMock());
    expect(service.checkQueryAllowed({ userId: "u1", tier: "PRO", aiQueryCount: 29 })).toEqual({
      allowed: true,
      limit: 30,
      remaining: 1,
    });
  });

  it("rejects PRO user at 30 queries", () => {
    const service = new BillingService(buildRepositoryMock());
    expect(service.checkQueryAllowed({ userId: "u1", tier: "PRO", aiQueryCount: 30 })).toEqual({
      allowed: false,
      limit: 30,
      remaining: 0,
      error: "QUERY_LIMIT_REACHED",
      upgradeUrl: "/pricing",
    });
  });

  it("always allows PREMIUM user", () => {
    const service = new BillingService(buildRepositoryMock());
    expect(
      service.checkQueryAllowed({ userId: "u1", tier: "PREMIUM", aiQueryCount: 1000 }),
    ).toEqual({
      allowed: true,
      limit: null,
      remaining: null,
    });
  });

  it("increments usage record for current month", async () => {
    const repo = buildRepositoryMock();
    const service = new BillingService(repo);
    await service.incrementQueryUsage("u1", new Date("2026-04-15T00:00:00.000Z"));
    expect(repo.incrementUsage).toHaveBeenCalledWith("u1", "2026-04");
  });
});
