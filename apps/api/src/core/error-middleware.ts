import type { NextFunction, Request, Response } from "express";

import { AppError } from "./errors.js";

const CLIENT_SAFE_500_MESSAGE = "Something went wrong. Please try again later.";

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;
  if (error instanceof AppError) {
    if (error.details !== undefined) {
      console.error("[CallSight API] AppError details (not sent to client):", error.details);
    }
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  console.error("[CallSight API] Unhandled error:", error);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: CLIENT_SAFE_500_MESSAGE,
    },
  });
}
