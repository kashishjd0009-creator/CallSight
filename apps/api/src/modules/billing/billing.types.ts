import type { Tier } from "../users/user.types.js";

export interface UsageRecord {
  userId: string;
  month: string;
  aiQueryCount: number;
}

export interface QueryAllowance {
  allowed: boolean;
  limit: number | null;
  remaining: number | null;
  error?: "QUERY_LIMIT_REACHED";
  upgradeUrl?: "/pricing";
}

export interface UserBillingSnapshot {
  userId: string;
  tier: Tier;
  aiQueryCount: number;
}
