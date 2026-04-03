import type { CookieOptions } from "express";

/**
 * Browsers only send cookies on cross-origin `fetch(..., { credentials: "include" })`
 * when Set-Cookie uses `SameSite=None` and `Secure`. Use this for split hosting
 * (e.g. Vercel + Render). Local dev typically uses `sameSite: "lax"` without `secure`.
 */
export function buildAuthCookieOptions(crossSite: boolean): CookieOptions {
  if (crossSite) {
    return {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
    };
  }
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  };
}
