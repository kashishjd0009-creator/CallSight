import type { PrismaClient } from "@prisma/client";

import type { Tier } from "../users/user.types.js";
import type { UsageRecord } from "./billing.types.js";

export interface IBillingRepository {
  getUserTier(userId: string): Promise<Tier | null>;
  getUsageRecord(userId: string, month: string): Promise<UsageRecord | null>;
  upsertUsageRecord(userId: string, month: string, aiQueryCount: number): Promise<UsageRecord>;
  incrementUsage(userId: string, month: string): Promise<UsageRecord>;
}

function mapTier(t: "FREE" | "PRO" | "PREMIUM"): Tier {
  return t;
}

export class PrismaBillingRepository implements IBillingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getUserTier(userId: string): Promise<Tier | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });
    return user ? mapTier(user.tier) : null;
  }

  async getUsageRecord(userId: string, month: string): Promise<UsageRecord | null> {
    const row = await this.prisma.usageRecord.findUnique({
      where: {
        userId_month: { userId, month },
      },
    });
    return row
      ? {
          userId: row.userId,
          month: row.month,
          aiQueryCount: row.aiQueryCount,
        }
      : null;
  }

  async upsertUsageRecord(
    userId: string,
    month: string,
    aiQueryCount: number,
  ): Promise<UsageRecord> {
    const row = await this.prisma.usageRecord.upsert({
      where: { userId_month: { userId, month } },
      create: { userId, month, aiQueryCount },
      update: { aiQueryCount },
    });
    return {
      userId: row.userId,
      month: row.month,
      aiQueryCount: row.aiQueryCount,
    };
  }

  async incrementUsage(userId: string, month: string): Promise<UsageRecord> {
    const row = await this.prisma.usageRecord.upsert({
      where: { userId_month: { userId, month } },
      create: { userId, month, aiQueryCount: 1 },
      update: { aiQueryCount: { increment: 1 } },
    });
    return {
      userId: row.userId,
      month: row.month,
      aiQueryCount: row.aiQueryCount,
    };
  }
}

export class InMemoryBillingRepository implements IBillingRepository {
  private readonly userTiers = new Map<string, Tier>();
  private readonly usage = new Map<string, UsageRecord>();

  async getUserTier(userId: string): Promise<Tier | null> {
    return this.userTiers.get(userId) ?? "FREE";
  }

  async getUsageRecord(userId: string, month: string): Promise<UsageRecord | null> {
    return this.usage.get(`${userId}:${month}`) ?? null;
  }

  async upsertUsageRecord(
    userId: string,
    month: string,
    aiQueryCount: number,
  ): Promise<UsageRecord> {
    const value = { userId, month, aiQueryCount };
    this.usage.set(`${userId}:${month}`, value);
    return value;
  }

  async incrementUsage(userId: string, month: string): Promise<UsageRecord> {
    const key = `${userId}:${month}`;
    const current = this.usage.get(key) ?? { userId, month, aiQueryCount: 0 };
    const next = { ...current, aiQueryCount: current.aiQueryCount + 1 };
    this.usage.set(key, next);
    return next;
  }

  seedUserTier(userId: string, tier: Tier): void {
    this.userTiers.set(userId, tier);
  }
}
