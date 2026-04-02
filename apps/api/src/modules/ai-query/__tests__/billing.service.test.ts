import { describe, expect, it } from "vitest";

import { BillingService } from "../../billing/billing.service.js";
import type { IBillingRepository } from "../../billing/billing.repository.js";

describe("BillingService", () => {
  const mockRepository: IBillingRepository = {
    getUserTier: async () => "PRO",
    getUsageRecord: async () => null,
    upsertUsageRecord: async () => ({ userId: "u1", month: "2026-04", aiQueryCount: 0 }),
    incrementUsage: async () => ({ userId: "u1", month: "2026-04", aiQueryCount: 1 }),
  };
  const service = new BillingService(mockRepository);

  it("allows PRO user at 29 queries", () => {
    expect(service.checkQueryAllowed({ userId: "u1", tier: "PRO", aiQueryCount: 29 })).toEqual({
      allowed: true,
      limit: 30,
      remaining: 1,
    });
  });

  it("rejects PRO user at 30 queries", () => {
    expect(service.checkQueryAllowed({ userId: "u1", tier: "PRO", aiQueryCount: 30 })).toEqual({
      allowed: false,
      limit: 30,
      remaining: 0,
      error: "QUERY_LIMIT_REACHED",
      upgradeUrl: "/pricing",
    });
  });

  it("always allows PREMIUM user", () => {
    expect(
      service.checkQueryAllowed({ userId: "u1", tier: "PREMIUM", aiQueryCount: 1000 }),
    ).toEqual({
      allowed: true,
      limit: null,
      remaining: null,
    });
  });
});
