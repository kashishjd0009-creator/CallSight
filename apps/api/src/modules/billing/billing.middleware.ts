import type { NextFunction, Request, Response } from "express";

import type { Tier } from "../users/user.types.js";

const tierOrder: Record<Tier, number> = {
  FREE: 1,
  PRO: 2,
  PREMIUM: 3,
};

interface TierResolver {
  getTierByUserId(userId: string): Promise<Tier | null>;
}

export function requireTier(minTier: Tier, tierResolver: TierResolver) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      res
        .status(401)
        .json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing auth" } });
      return;
    }

    const tier = await tierResolver.getTierByUserId(auth.userId);
    if (!tier || tierOrder[tier] < tierOrder[minTier]) {
      res.status(403).json({
        success: false,
        error: { code: "UPGRADE_REQUIRED", message: "Upgrade required" },
        upgradeUrl: "/pricing",
      });
      return;
    }
    next();
  };
}
