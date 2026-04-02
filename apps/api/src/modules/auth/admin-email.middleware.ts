import type { NextFunction, Request, Response } from "express";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function requireAdminEmail(adminEmail: string) {
  const admin = normalizeEmail(adminEmail);
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = (req as Request & { auth?: { email?: string } }).auth;
    if (!auth?.email) {
      res
        .status(401)
        .json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing auth" } });
      return;
    }
    if (normalizeEmail(auth.email) !== admin) {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Forbidden" } });
      return;
    }
    next();
  };
}
