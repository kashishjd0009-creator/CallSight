import type { IBillingRepository } from "./billing.repository.js";
import type { QueryAllowance, UserBillingSnapshot } from "./billing.types.js";

function currentMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export class BillingService {
  constructor(private readonly billingRepository: IBillingRepository) {}

  async getUserSnapshot(userId: string, now: Date = new Date()): Promise<UserBillingSnapshot> {
    const tier = await this.billingRepository.getUserTier(userId);
    if (!tier) {
      throw new Error("USER_NOT_FOUND");
    }

    const month = currentMonth(now);
    const usage = await this.billingRepository.getUsageRecord(userId, month);
    return {
      userId,
      tier,
      aiQueryCount: usage?.aiQueryCount ?? 0,
    };
  }

  checkQueryAllowed(snapshot: UserBillingSnapshot): QueryAllowance {
    if (snapshot.tier === "PREMIUM") {
      return { allowed: true, limit: null, remaining: null };
    }
    if (snapshot.tier === "FREE") {
      return {
        allowed: false,
        limit: 0,
        remaining: 0,
        error: "QUERY_LIMIT_REACHED",
        upgradeUrl: "/pricing",
      };
    }

    const limit = 30;
    const remaining = Math.max(0, limit - snapshot.aiQueryCount);
    if (snapshot.aiQueryCount >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        error: "QUERY_LIMIT_REACHED",
        upgradeUrl: "/pricing",
      };
    }
    return { allowed: true, limit, remaining };
  }

  async checkQueryAllowedForUser(userId: string, now: Date = new Date()): Promise<QueryAllowance> {
    const snapshot = await this.getUserSnapshot(userId, now);
    return this.checkQueryAllowed(snapshot);
  }

  async incrementQueryUsage(userId: string, now: Date = new Date()): Promise<void> {
    const month = currentMonth(now);
    await this.billingRepository.incrementUsage(userId, month);
  }
}
