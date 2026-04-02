import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import type { JwtPayload } from "./auth.types.js";

export function requireAuth(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.cookies?.accessToken as string | undefined;
    if (!token) {
      res
        .status(401)
        .json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing token" } });
      return;
    }

    try {
      const payload = jwt.verify(token, jwtSecret) as JwtPayload;
      (req as Request & { auth?: JwtPayload }).auth = payload;
      next();
    } catch {
      res
        .status(401)
        .json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid token" } });
    }
  };
}
