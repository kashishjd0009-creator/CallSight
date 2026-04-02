import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../core/errors.js";
import type { IAuthRepository } from "../auth.repository.js";
import { AuthService } from "../auth.service.js";
import type { AuthUser } from "../auth.types.js";

function createUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "test@example.com",
    passwordHash: "$2b$12$T.afQbC2LNUvPIvz9tyNqO9kwUInIxET.yR3OQKxxrwIFKA7GuJ6q",
    firstName: "Test",
    lastName: "User",
    tier: "FREE",
    isVerified: true,
    ...overrides,
  };
}

describe("AuthService", () => {
  let repo: IAuthRepository;
  let emails: {
    sendVerificationEmail: ReturnType<typeof vi.fn>;
    sendResetPasswordEmail: ReturnType<typeof vi.fn>;
  };
  let service: AuthService;

  beforeEach(() => {
    repo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      createUser: vi.fn(),
      updatePassword: vi.fn(),
      saveRefreshToken: vi.fn(),
      findRefreshToken: vi.fn(),
      revokeRefreshToken: vi.fn(),
      savePasswordResetToken: vi.fn(),
      findPasswordResetToken: vi.fn(),
      consumePasswordResetToken: vi.fn(),
      setVerified: vi.fn(),
      revokeAllRefreshTokensForUser: vi.fn(),
    };
    emails = {
      sendVerificationEmail: vi.fn(),
      sendResetPasswordEmail: vi.fn(),
    };
    service = new AuthService(repo, emails, {
      jwtSecret: "a".repeat(32),
      jwtRefreshSecret: "b".repeat(32),
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 604800,
      passwordResetTtlSeconds: 3600,
    });
  });

  it("registers user and returns tokens", async () => {
    vi.mocked(repo.findByEmail).mockResolvedValue(null);
    vi.mocked(repo.createUser).mockResolvedValue(createUser());

    const result = await service.register({
      email: "test@example.com",
      password: "Test1234!",
      firstName: "Test",
      lastName: "User",
    });

    expect(result.user.email).toBe("test@example.com");
    expect(result.tokens.accessToken.length).toBeGreaterThan(10);
    expect(result.tokens.refreshToken.length).toBeGreaterThan(10);
    expect(emails.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("logs in with correct credentials", async () => {
    vi.mocked(repo.findByEmail).mockResolvedValue(createUser());
    const result = await service.login("test@example.com", "Test1234!");
    expect(result.user.id).toBe("u1");
    expect(result.tokens.accessToken.length).toBeGreaterThan(10);
  });

  it("rejects login with 401 INVALID_CREDENTIALS when user not found", async () => {
    vi.mocked(repo.findByEmail).mockResolvedValue(null);
    await expect(service.login("missing@example.com", "Test1234!")).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
    await expect(service.login("missing@example.com", "Test1234!")).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("rejects login with 401 INVALID_CREDENTIALS when password wrong", async () => {
    vi.mocked(repo.findByEmail).mockResolvedValue(createUser());
    await expect(service.login("test@example.com", "WrongPassword!")).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  });

  it("refreshes token when refresh token is valid", async () => {
    vi.mocked(repo.findRefreshToken).mockResolvedValue({
      userId: "u1",
      expiresAt: new Date(Date.now() + 100_000),
    });
    vi.mocked(repo.findById).mockResolvedValue(createUser());

    const tokens = await service.refresh("rt");
    expect(tokens.accessToken.length).toBeGreaterThan(10);
    expect(repo.revokeRefreshToken).toHaveBeenCalledWith("rt");
  });

  it("creates password reset token and sends email", async () => {
    vi.mocked(repo.findByEmail).mockResolvedValue(createUser());
    await service.requestPasswordReset("test@example.com");
    expect(repo.savePasswordResetToken).toHaveBeenCalledTimes(1);
    expect(emails.sendResetPasswordEmail).toHaveBeenCalledTimes(1);
  });

  it("changes password when current password is valid", async () => {
    vi.mocked(repo.findById).mockResolvedValue(createUser());
    vi.mocked(repo.updatePassword).mockResolvedValue(undefined);
    vi.mocked(repo.revokeAllRefreshTokensForUser).mockResolvedValue(undefined);
    const tokens = await service.changePassword("u1", "Test1234!", "NewStrong456!");
    expect(tokens.accessToken.length).toBeGreaterThan(10);
    expect(repo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith("u1");
  });

  it("resets password when token is valid", async () => {
    vi.mocked(repo.findPasswordResetToken).mockResolvedValue({
      userId: "u1",
      expiresAt: new Date(Date.now() + 100_000),
    });
    await service.resetPassword("reset-token", "NewStrong123!");
    expect(repo.updatePassword).toHaveBeenCalledTimes(1);
    expect(repo.consumePasswordResetToken).toHaveBeenCalledWith("reset-token");
  });
});
