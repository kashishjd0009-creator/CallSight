import type { PrismaClient } from "@prisma/client";

import type { CreateUserDto, Tier, UserEntity } from "./user.types.js";

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  create(data: CreateUserDto): Promise<UserEntity>;
  updateTier(id: string, tier: Tier): Promise<UserEntity>;
  updateProfile(
    id: string,
    data: Partial<Pick<UserEntity, "firstName" | "lastName" | "email">>,
  ): Promise<UserEntity>;
}

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async create(data: CreateUserDto): Promise<UserEntity> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        tier: data.tier ?? "FREE",
      },
    });
  }

  async updateTier(id: string, tier: Tier): Promise<UserEntity> {
    return this.prisma.user.update({
      where: { id },
      data: { tier },
    });
  }

  async updateProfile(
    id: string,
    data: Partial<Pick<UserEntity, "firstName" | "lastName" | "email">>,
  ): Promise<UserEntity> {
    const payload: { firstName?: string; lastName?: string; email?: string } = {};
    if (data.firstName !== undefined) {
      payload.firstName = data.firstName;
    }
    if (data.lastName !== undefined) {
      payload.lastName = data.lastName;
    }
    if (data.email !== undefined) {
      payload.email = data.email.toLowerCase();
    }
    return this.prisma.user.update({
      where: { id },
      data: payload,
    });
  }
}
