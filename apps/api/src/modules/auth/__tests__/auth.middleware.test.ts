import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { requireAuth } from "../auth.middleware.js";

function buildApp(secret: string) {
  const app = express();
  app.use((req, _res, next) => {
    const cookie = req.header("cookie");
    if (cookie?.startsWith("accessToken=")) {
      const token = cookie.replace("accessToken=", "");
      (req as express.Request & { cookies?: Record<string, string> }).cookies = {
        accessToken: token,
      };
    }
    next();
  });
  app.get("/secure", requireAuth(secret), (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe("requireAuth", () => {
  const secret = "c".repeat(32);

  it("returns 401 when token missing", async () => {
    const app = buildApp(secret);
    const response = await request(app).get("/secure");
    expect(response.status).toBe(401);
  });

  it("returns 200 for valid token", async () => {
    const app = buildApp(secret);
    const token = jwt.sign({ userId: "u1", email: "a@b.com" }, secret, { expiresIn: 300 });
    const response = await request(app).get("/secure").set("Cookie", `accessToken=${token}`);
    expect(response.status).toBe(200);
  });

  it("returns 401 for expired token", async () => {
    const app = buildApp(secret);
    const token = jwt.sign({ userId: "u1", email: "a@b.com" }, secret, { expiresIn: -1 });
    const response = await request(app).get("/secure").set("Cookie", `accessToken=${token}`);
    expect(response.status).toBe(401);
  });
});
