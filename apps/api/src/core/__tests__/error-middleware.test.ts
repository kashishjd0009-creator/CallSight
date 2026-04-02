import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { errorMiddleware } from "../error-middleware.js";
import { AppError } from "../errors.js";

describe("errorMiddleware", () => {
  it("returns generic message for unknown errors", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const req = {} as Request;
    const next = vi.fn();

    try {
      errorMiddleware(new Error("Invalid `prisma.foo` invocation:\nsecret"), req, res, next);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong. Please try again later.",
        },
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("passes through AppError message", () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const req = {} as Request;
    const next = vi.fn();

    errorMiddleware(new AppError(401, "UNAUTHORIZED", "Missing auth"), req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing auth",
      },
    });
  });

  it("logs AppError details but omits details from JSON", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const req = {} as Request;
    const next = vi.fn();

    try {
      errorMiddleware(
        new AppError(422, "VALIDATION_ERROR", "Invalid request body", { fieldErrors: true }),
        req,
        res,
        next,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[CallSight API] AppError details (not sent to client):",
        { fieldErrors: true },
      );
      expect(json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
        },
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
