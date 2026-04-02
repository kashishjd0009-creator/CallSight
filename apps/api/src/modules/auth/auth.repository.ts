import type { PrismaClient } from "@prisma/client";

import type { AuthUser, RegisterInput, Tier } from "./auth.types.js";

export interface IAuthRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  createUser(input: RegisterInput & { passwordHash: string }): Promise<AuthUser>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  saveRefreshToken(userId: string, refreshToken: string, expiresAt: Date): Promise<void>;
  findRefreshToken(refreshToken: string): Promise<{ userId: string; expiresAt: Date } | null>;
  revokeRefreshToken(refreshToken: string): Promise<void>;
  revokeAllRefreshTokensForUser(userId: string): Promise<void>;
  savePasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  findPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date } | null>;
  consumePasswordResetToken(token: string): Promise<void>;
  setVerified(userId: string): Promise<void>;
}

function toAuthUser(row: {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  tier: "FREE" | "PRO" | "PREMIUM";
  isVerified: boolean;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    firstName: row.firstName,
    lastName: row.lastName,
    tier: row.tier as Tier,
    isVerified: row.isVerified,
  };
}

export class PrismaAuthRepository implements IAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return row ? toAuthUser(row) : null;
  }

  async findById(id: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toAuthUser(row) : null;
  }

  async createUser(input: RegisterInput & { passwordHash: string }): Promise<AuthUser> {
    const row = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        tier: "FREE",
        isVerified: false,
      },
    });
    return toAuthUser(row);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async saveRefreshToken(userId: string, refreshToken: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshSession.create({
      data: { userId, token: refreshToken, expiresAt },
    });
  }

  async findRefreshToken(
    refreshToken: string,
  ): Promise<{ userId: string; expiresAt: Date } | null> {
    const row = await this.prisma.refreshSession.findUnique({
      where: { token: refreshToken },
    });
    return row ? { userId: row.userId, expiresAt: row.expiresAt } : null;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await this.prisma.refreshSession.deleteMany({
      where: { token: refreshToken },
    });
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.prisma.refreshSession.deleteMany({
      where: { userId },
    });
  }

  async savePasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } });
    await this.prisma.passwordResetToken.create({
      data: { userId, token, expiresAt },
    });
  }

  async findPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });
    return row ? { userId: row.userId, expiresAt: row.expiresAt } : null;
  }

  async consumePasswordResetToken(token: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { token } });
  }

  async setVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
    });
  }
}

export class InMemoryAuthRepository implements IAuthRepository {
  private readonly usersById = new Map<string, AuthUser>();
  private readonly usersByEmail = new Map<string, AuthUser>();
  private readonly refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();
  private readonly resetTokens = new Map<string, { userId: string; expiresAt: Date }>();

  async findByEmail(email: string): Promise<AuthUser | null> {
    return this.usersByEmail.get(email.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<AuthUser | null> {
    return this.usersById.get(id) ?? null;
  }

  async createUser(input: RegisterInput & { passwordHash: string }): Promise<AuthUser> {
    const user: AuthUser = {
      id: crypto.randomUUID(),
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      tier: "FREE" satisfies Tier,
      isVerified: false,
    };
    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
    return user;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const current = this.usersById.get(userId);
    if (!current) {
      return;
    }
    const updated: AuthUser = { ...current, passwordHash };
    this.usersById.set(userId, updated);
    this.usersByEmail.set(updated.email, updated);
  }

  async saveRefreshToken(userId: string, refreshToken: string, expiresAt: Date): Promise<void> {
    this.refreshTokens.set(refreshToken, { userId, expiresAt });
  }

  async findRefreshToken(
    refreshToken: string,
  ): Promise<{ userId: string; expiresAt: Date } | null> {
    return this.refreshTokens.get(refreshToken) ?? null;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    this.refreshTokens.delete(refreshToken);
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    for (const [token, meta] of this.refreshTokens.entries()) {
      if (meta.userId === userId) {
        this.refreshTokens.delete(token);
      }
    }
  }

  async savePasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    this.resetTokens.set(token, { userId, expiresAt });
  }

  async findPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
    return this.resetTokens.get(token) ?? null;
  }

  async consumePasswordResetToken(token: string): Promise<void> {
    this.resetTokens.delete(token);
  }

  async setVerified(userId: string): Promise<void> {
    void userId;
  }
}
