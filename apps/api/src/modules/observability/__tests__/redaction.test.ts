import { describe, expect, it } from "vitest";

import { redactPayload } from "../redaction.js";

describe("redactPayload", () => {
  it("replaces sensitive keys at any depth", () => {
    const input = {
      user: "x",
      password: "secret",
      nested: { currentPassword: "p", token: "t" },
    };
    const out = redactPayload(input) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).currentPassword).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).token).toBe("[REDACTED]");
  });

  it("truncates long strings", () => {
    const long = "a".repeat(600);
    const out = redactPayload({ note: long }) as { note: string };
    expect(out.note.length).toBeLessThanOrEqual(520);
    expect(out.note).toContain("truncated");
  });

  it("does not truncate Gemini probe full-text keys", () => {
    const long = "q".repeat(600);
    const out = redactPayload({ userQuery: long }) as { userQuery: string };
    expect(out.userQuery).toBe(long);
  });

  it("passes through safe primitives", () => {
    expect(redactPayload(42)).toBe(42);
    expect(redactPayload(true)).toBe(true);
    expect(redactPayload(null)).toBe(null);
  });
});
