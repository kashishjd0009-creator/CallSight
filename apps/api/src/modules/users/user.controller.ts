import type { Request, Response } from "express";

import { AppError } from "../../core/errors.js";
import { ok } from "../../core/http.js";
import type { BillingService } from "../billing/billing.service.js";
import type { IUserRepository } from "./user.repository.js";

export class UserController {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly billingService: BillingService,
  ) {}

  getMe = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }

    const user = await this.userRepository.findById(auth.userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    ok(res, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tier: user.tier,
      isVerified: user.isVerified,
    });
  };

  patchMe = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }

    const body = req.body as Partial<{ firstName: string; lastName: string; email: string }>;
    const updated = await this.userRepository.updateProfile(auth.userId, {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
    });
    ok(res, {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      tier: updated.tier,
      isVerified: updated.isVerified,
    });
  };

  getTier = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }

    const user = await this.userRepository.findById(auth.userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const snapshot = await this.billingService.getUserSnapshot(auth.userId);
    const queriesLimit = user.tier === "PRO" ? 30 : user.tier === "PREMIUM" ? null : 0;
    ok(res, {
      tier: user.tier,
      features: [],
      queriesUsed: snapshot.aiQueryCount,
      queriesLimit,
    });
  };
}
