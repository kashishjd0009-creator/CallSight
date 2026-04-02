import { describe, expect, it } from "vitest";

import { loadEnv } from "../env.js";

describe("loadEnv", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://localhost:5432/callsight",
    DIRECT_URL: "postgresql://localhost:5432/callsight",
    JWT_SECRET: "x".repeat(32),
    JWT_REFRESH_SECRET: "y".repeat(32),
    GEMINI_API_KEY: "k",
    SMTP_HOST: "smtp.ethereal.email",
    SMTP_PORT: "587",
    SMTP_USER: "u",
    SMTP_PASS: "p",
    FRONTEND_URL: "http://localhost:5173",
    NODE_ENV: "development",
    PORT: "3001",
    LOG_LEVEL: "info",
    ADMIN_EMAIL: "admin@test.com",
  } as const;

  it("throws when ADMIN_EMAIL is missing", () => {
    const withoutAdmin = { ...baseEnv };
    Reflect.deleteProperty(withoutAdmin, "ADMIN_EMAIL");
    expect(() => loadEnv(withoutAdmin)).toThrow("ADMIN_EMAIL");
  });
});
