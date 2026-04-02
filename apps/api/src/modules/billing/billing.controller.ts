import type { Request, Response } from "express";

import { AppError } from "../../core/errors.js";
import { ok } from "../../core/http.js";
import type { BillingService } from "./billing.service.js";

export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  getUsage = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const snapshot = await this.billingService.getUserSnapshot(auth.userId);
    const allowance = this.billingService.checkQueryAllowed(snapshot);
    ok(res, {
      used: snapshot.aiQueryCount,
      limit: allowance.limit,
      remaining: allowance.remaining,
    });
  };
}
