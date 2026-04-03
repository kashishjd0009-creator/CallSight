import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  GEMINI_API_KEY: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().min(1),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  FRONTEND_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("3001"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  ADMIN_EMAIL: z.string().email(),
});

export type AppEnv = z.infer<typeof envSchema> & {
  /** When true, auth cookies use SameSite=None; Secure (needed for split frontend/API domains). */
  authCookieCrossSite: boolean;
};

function resolveAuthCookieCrossSite(raw: NodeJS.ProcessEnv, nodeEnv: string): boolean {
  const v = raw.AUTH_COOKIE_CROSS_SITE;
  if (v === "true") return true;
  if (v === "false") return false;
  return nodeEnv === "production";
}

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const key = firstIssue?.path[0];
    throw new Error(`Missing required environment variable: ${String(key ?? "UNKNOWN")}`);
  }
  const data = parsed.data;
  return {
    ...data,
    authCookieCrossSite: resolveAuthCookieCrossSite(raw, data.NODE_ENV),
  };
}
