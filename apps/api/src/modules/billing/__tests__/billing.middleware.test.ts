import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { requireTier } from "../billing.middleware.js";

describe("requireTier middleware", () => {
  it("returns 401 when auth is missing", async () => {
    const app = express();
    app.get("/pro", requireTier("PRO", { getTierByUserId: vi.fn() }), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const response = await request(app).get("/pro");
    expect(response.status).toBe(401);
  });

  it("returns 403 when user tier is insufficient", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { auth?: { userId: string } }).auth = { userId: "u1" };
      next();
    });
    app.get(
      "/pro",
      requireTier("PRO", { getTierByUserId: vi.fn().mockResolvedValue("FREE") }),
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );
    const response = await request(app).get("/pro");
    expect(response.status).toBe(403);
  });
});
