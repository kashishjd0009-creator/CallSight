import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { requireAdminEmail } from "../admin-email.middleware.js";

describe("requireAdminEmail middleware", () => {
  it("returns 401 when auth is missing", async () => {
    const app = express();
    app.get("/admin", requireAdminEmail("admin@test.com"), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const response = await request(app).get("/admin");
    expect(response.status).toBe(401);
  });

  it("returns 403 when email does not match admin email", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { auth?: { userId: string; email: string } }).auth = {
        userId: "u1",
        email: "other@test.com",
      };
      next();
    });
    app.get("/admin", requireAdminEmail("admin@test.com"), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const response = await request(app).get("/admin");
    expect(response.status).toBe(403);
  });

  it("allows case-insensitive admin email match", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { auth?: { userId: string; email: string } }).auth = {
        userId: "u1",
        email: "Admin@Test.com",
      };
      next();
    });
    app.get("/admin", requireAdminEmail("admin@test.com"), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const response = await request(app).get("/admin");
    expect(response.status).toBe(200);
  });
});
