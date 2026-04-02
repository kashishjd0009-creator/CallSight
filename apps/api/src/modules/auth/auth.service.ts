import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { AppError } from "../../core/errors.js";
import type { IAuthRepository } from "./auth.repository.js";
import type {
  AuthTokens,
  AuthUser,
  JwtPayload,
  PublicAuthUser,
  RegisterInput,
} from "./auth.types.js";

interface EmailSender {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendResetPasswordEmail(email: string, token: string): Promise<void>;
}

interface AuthConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  passwordResetTtlSeconds: number;
}

export class AuthService {
  constructor(
    private readonly authRepository: IAuthRepository,
    private readonly emailSender: EmailSender,
    private readonly config: AuthConfig,
  ) {}

  async register(input: RegisterInput): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const existing = await this.authRepository.findByEmail(input.email.toLowerCase());
    if (existing) {
      throw new Error("EMAIL_ALREADY_IN_USE");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.authRepository.createUser({
      ...input,
      email: input.email.toLowerCase(),
      passwordHash,
    });

    const verificationToken = crypto.randomUUID();
    await this.emailSender.sendVerificationEmail(user.email, verificationToken);
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const user = await this.authRepository.findByEmail(email.toLowerCase());
    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const record = await this.authRepository.findRefreshToken(refreshToken);
    if (!record || record.expiresAt <= new Date()) {
      throw new Error("INVALID_REFRESH_TOKEN");
    }

    const user = await this.authRepository.findById(record.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    await this.authRepository.revokeRefreshToken(refreshToken);
    return this.issueTokens(user);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.authRepository.findByEmail(email.toLowerCase());
    if (!user) {
      return;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.config.passwordResetTtlSeconds * 1000);
    await this.authRepository.savePasswordResetToken(user.id, token, expiresAt);
    await this.emailSender.sendResetPasswordEmail(user.email, token);
  }

  async getPublicProfile(userId: string): Promise<PublicAuthUser> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    const { passwordHash: _hash, ...publicUser } = user;
    void _hash;
    return publicUser;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthTokens> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new Error("INVALID_CURRENT_PASSWORD");
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.authRepository.updatePassword(userId, passwordHash);
    await this.authRepository.revokeAllRefreshTokensForUser(userId);
    const updated = await this.authRepository.findById(userId);
    if (!updated) {
      throw new Error("USER_NOT_FOUND");
    }
    return this.issueTokens(updated);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.authRepository.findPasswordResetToken(token);
    if (!record || record.expiresAt <= new Date()) {
      throw new Error("INVALID_RESET_TOKEN");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.authRepository.updatePassword(record.userId, passwordHash);
    await this.authRepository.consumePasswordResetToken(token);
  }

  private async issueTokens(user: AuthUser): Promise<AuthTokens> {
    const payload: JwtPayload = { userId: user.id, email: user.email };
    const accessToken = jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.accessTokenTtlSeconds,
    });
    const refreshToken = jwt.sign(payload, this.config.jwtRefreshSecret, {
      expiresIn: this.config.refreshTokenTtlSeconds,
    });

    await this.authRepository.saveRefreshToken(
      user.id,
      refreshToken,
      new Date(Date.now() + this.config.refreshTokenTtlSeconds * 1000),
    );
    return { accessToken, refreshToken };
  }
}
