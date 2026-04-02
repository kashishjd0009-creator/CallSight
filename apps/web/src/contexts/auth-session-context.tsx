import { createContext, useContext } from "react";

import type { AuthAccount } from "../lib/auth-api.js";

export type AuthSessionContextValue = {
  account: AuthAccount;
  /** True when GET /api/v1/probe/events is allowed (admin probe viewer). */
  canViewProbe: boolean;
  /** Re-fetch /auth/me and probe access (e.g. after profile or password change). */
  refreshSession: () => Promise<void>;
};

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function useAuthSession(): AuthSessionContextValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used within ProtectedRoute");
  }
  return ctx;
}
