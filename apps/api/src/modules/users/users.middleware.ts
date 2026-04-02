import type { NextFunction, Request, Response } from "express";

import type { Tier } from "./user.types.js";

const tierOrder: Record<Tier, number> = {
  FREE: 1,
  PRO: 2,
  PREMIUM: 3,
};

interface UserTierLookup {
  getTierByUserId(userId: string): Promise<Tier | null>;
}

export function requireTier(minTier: Tier, userTierLookup: UserTierLookup) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      res
        .status(401)
        .json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing auth" } });
      return;
    }

    const userTier = await userTierLookup.getTierByUserId(auth.userId);
    if (!userTier || tierOrder[userTier] < tierOrder[minTier]) {
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
