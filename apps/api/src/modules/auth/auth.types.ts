export type Tier = "FREE" | "PRO" | "PREMIUM";

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  tier: Tier;
  isVerified: boolean;
}

export type PublicAuthUser = Omit<AuthUser, "passwordHash">;

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
}
