import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import {
  AuthSessionContext,
  type AuthSessionContextValue,
} from "../../contexts/auth-session-context.js";
import type { AuthAccount } from "../../lib/auth-api.js";
import { fetchAuthMe, fetchWithAuthRetry } from "../../lib/auth-api.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const PROBE_PROBE_URL = `${API_URL}/api/v1/probe/events?page=1&pageSize=1`;

async function loadSession(): Promise<{ account: AuthAccount; canViewProbe: boolean }> {
  const account = await fetchAuthMe();
  const probeRes = await fetchWithAuthRetry(PROBE_PROBE_URL);
  return { account, canViewProbe: probeRes.ok };
}

export function ProtectedRoute() {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "ok" | "out">("loading");
  const [session, setSession] = useState<{ account: AuthAccount; canViewProbe: boolean } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void loadSession()
      .then((data) => {
        if (!cancelled) {
          setSession(data);
          setStatus("ok");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("out");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshSession = useCallback(async () => {
    const data = await loadSession();
    setSession(data);
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-sm text-text-secondary">
        Checking session…
      </div>
    );
  }

  if (status === "out") {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (!session) {
    return null;
  }

  const value: AuthSessionContextValue = {
    account: session.account,
    canViewProbe: session.canViewProbe,
    refreshSession,
  };

  return (
    <AuthSessionContext.Provider value={value}>
      <Outlet />
    </AuthSessionContext.Provider>
  );
}
