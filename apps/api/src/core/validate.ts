import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";

import { AppError } from "./errors.js";

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(422, "VALIDATION_ERROR", "Invalid request body", result.error.flatten());
    }
    req.body = result.data;
    next();
  };
}
