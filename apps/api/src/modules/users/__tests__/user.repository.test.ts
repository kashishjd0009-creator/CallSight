import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { PrismaUserRepository } from "../user.repository.js";
import type { UserEntity } from "../user.types.js";

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: "u1",
    email: "user@test.com",
    passwordHash: "hash",
    firstName: "User",
    lastName: "Test",
    tier: "FREE",
    isVerified: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("PrismaUserRepository", () => {
  it("findById returns a user", async () => {
    const findUnique = vi.fn().mockResolvedValue(buildUser());
    const repository = new PrismaUserRepository({
      user: {
        findUnique,
        create: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaClient);

    const user = await repository.findById("u1");
    expect(user?.id).toBe("u1");
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("findByEmail returns a user", async () => {
    const findUnique = vi.fn().mockResolvedValue(buildUser());
    const repository = new PrismaUserRepository({
      user: {
        findUnique,
        create: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaClient);

    const user = await repository.findByEmail("user@test.com");
    expect(user?.email).toBe("user@test.com");
    expect(findUnique).toHaveBeenCalledWith({ where: { email: "user@test.com" } });
  });

  it("create persists and returns new user", async () => {
    const create = vi.fn().mockResolvedValue(buildUser());
    const repository = new PrismaUserRepository({
      user: {
        findUnique: vi.fn(),
        create,
        update: vi.fn(),
      },
    } as unknown as PrismaClient);

    const result = await repository.create({
      email: "user@test.com",
      passwordHash: "hash",
      firstName: "User",
      lastName: "Test",
    });

    expect(result.email).toBe("user@test.com");
    expect(create).toHaveBeenCalledWith({
      data: {
        email: "user@test.com",
        passwordHash: "hash",
        firstName: "User",
        lastName: "Test",
        tier: "FREE",
      },
    });
  });

  it("updateTier updates and returns user", async () => {
    const update = vi.fn().mockResolvedValue(buildUser({ tier: "PRO" }));
    const repository = new PrismaUserRepository({
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update,
      },
    } as unknown as PrismaClient);

    const result = await repository.updateTier("u1", "PRO");
    expect(result.tier).toBe("PRO");
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { tier: "PRO" },
    });
  });
});
