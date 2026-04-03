import type { CookieOptions, Request, Response } from "express";

import { AppError } from "../../core/errors.js";
import { ok } from "../../core/http.js";
import type { ObservabilityService } from "../observability/observability.service.js";
import { PipelineStep } from "../observability/pipeline-steps.js";
import { runProbe } from "../observability/pipeline-probe.js";
import type { ProbeContext } from "../observability/observability.types.js";
import { AuthService } from "./auth.service.js";
import type { AuthUser } from "./auth.types.js";

function publicAuthUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    tier: user.tier,
    isVerified: user.isVerified,
  };
}

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly observability: ObservabilityService,
    private readonly authCookieOptions: CookieOptions,
  ) {}

  private probeCtx(req: Request): ProbeContext {
    return {
      correlationId: req.correlationId,
      httpMethod: req.method,
      httpPath: req.originalUrl?.split("?")[0],
    };
  }

  register = async (req: Request, res: Response): Promise<void> => {
    const ctx = this.probeCtx(req);
    const { email, password, firstName, lastName } = req.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    };
    const result = await runProbe(
      this.observability,
      ctx,
      PipelineStep.AUTH_REGISTER,
      () => this.authService.register({ email, password, firstName, lastName }),
      (r) => ({
        userId: r.user.id,
        emailDomain: email.includes("@") ? email.split("@")[1] : "unknown",
      }),
    );
    ok(res, { user: publicAuthUser(result.user), tokens: result.tokens }, 201);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const ctx = this.probeCtx(req);
    const { email, password } = req.body as { email: string; password: string };
    const result = await runProbe(
      this.observability,
      ctx,
      PipelineStep.AUTH_LOGIN,
      () => this.authService.login(email, password),
      (r) => ({
        userId: r.user.id,
        emailDomain: email.includes("@") ? email.split("@")[1] : "unknown",
      }),
    );
    res.cookie("accessToken", result.tokens.accessToken, this.authCookieOptions);
    res.cookie("refreshToken", result.tokens.refreshToken, this.authCookieOptions);
    ok(res, { user: publicAuthUser(result.user), tokens: result.tokens });
  };

  logout = async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie("accessToken", this.authCookieOptions);
    res.clearCookie("refreshToken", this.authCookieOptions);
    ok(res, { loggedOut: true });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (!refreshToken) {
      throw new AppError(401, "UNAUTHORIZED", "Missing refresh token");
    }
    const tokens = await this.authService.refresh(refreshToken);
    res.cookie("accessToken", tokens.accessToken, this.authCookieOptions);
    res.cookie("refreshToken", tokens.refreshToken, this.authCookieOptions);
    ok(res, tokens);
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as { email?: string };
    if (!body.email) {
      throw new AppError(422, "VALIDATION_ERROR", "Email is required");
    }
    await this.authService.requestPasswordReset(body.email);
    ok(res, { requested: true });
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as { token?: string; password?: string };
    if (!body.token || !body.password) {
      throw new AppError(422, "VALIDATION_ERROR", "Token and password are required");
    }
    await this.authService.resetPassword(body.token, body.password);
    ok(res, { reset: true });
  };

  verifyEmail = async (_req: Request, res: Response): Promise<void> => {
    ok(res, { verified: true });
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    try {
      const tokens = await this.authService.changePassword(
        auth.userId,
        currentPassword,
        newPassword,
      );
      res.cookie("accessToken", tokens.accessToken, this.authCookieOptions);
      res.cookie("refreshToken", tokens.refreshToken, this.authCookieOptions);
      ok(res, { updated: true });
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_CURRENT_PASSWORD") {
        throw new AppError(422, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
      }
      if (e instanceof Error && e.message === "USER_NOT_FOUND") {
        throw new AppError(404, "NOT_FOUND", "User not found");
      }
      throw e;
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as Request & { auth?: { userId: string; email: string } }).auth;
    if (!auth?.userId) {
      throw new AppError(401, "UNAUTHORIZED", "Missing auth");
    }
    try {
      const profile = await this.authService.getPublicProfile(auth.userId);
      ok(res, profile);
    } catch (e) {
      if (e instanceof Error && e.message === "USER_NOT_FOUND") {
        throw new AppError(404, "NOT_FOUND", "User not found");
      }
      throw e;
    }
  };
}
