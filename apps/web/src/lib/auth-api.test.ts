import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { fetchAuthMe } from "./auth-api.js";

describe("fetchAuthMe", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const u = String(input);
        if (u.includes("/auth/refresh")) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          } as Response);
        }
        if (u.includes("/auth/me")) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({
              success: false,
              error: {
                code: "UNAUTHORIZED",
                message: "SECRET_PRISMA_DETAIL_DO_NOT_SHOW",
              },
            }),
          } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("does not surface raw API error.message to thrown Error text", async () => {
    await expect(fetchAuthMe()).rejects.toThrow();
    try {
      await fetchAuthMe();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).not.toContain("PRISMA");
      expect((e as Error).message).not.toContain("SECRET");
      expect((e as Error).message.toLowerCase()).toMatch(/sign in/);
    }
  });
});
