import { userMessageFromApiError } from "./map-api-error.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/** Uses refresh cookie to mint new access/refresh tokens. */
export async function refreshAuthSession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** On 401 (e.g. expired access token), refresh once then retry the same request. */
export async function fetchWithAuthRetry(input: string, init?: RequestInit): Promise<Response> {
  const merged: RequestInit = { credentials: "include", ...init };
  const response = await fetch(input, merged);
  if (response.status !== 401) {
    return response;
  }
  const refreshed = await refreshAuthSession();
  if (!refreshed) {
    return response;
  }
  return fetch(input, merged);
}

export type AuthAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tier: "FREE" | "PRO" | "PREMIUM";
  isVerified: boolean;
};

export async function fetchAuthMe(): Promise<AuthAccount> {
  const response = await fetchWithAuthRetry(`${API_URL}/api/v1/auth/me`);
  const body = (await response.json()) as {
    success?: boolean;
    data?: AuthAccount;
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    throw new Error(
      userMessageFromApiError(
        response.status,
        body.error,
        "We couldn't load your account. Try signing in again.",
      ),
    );
  }
  if (!body.data) {
    throw new Error("Invalid response");
  }
  return body.data;
}

/** Clears httpOnly session cookies on the API; safe to call even if the request fails. */
export async function postLogout(): Promise<void> {
  await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({}),
  });
}

export async function postAuth<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const errBody = body as { error?: { code?: string; message?: string } };
    throw new Error(
      userMessageFromApiError(response.status, errBody.error, "Request failed. Please try again."),
    );
  }

  return body as T;
}

export async function patchAuth<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetchWithAuthRetry(`${API_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const errBody = body as { error?: { code?: string; message?: string } };
    throw new Error(
      userMessageFromApiError(response.status, errBody.error, "Update failed. Please try again."),
    );
  }

  return body as T;
}

export async function postChangePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await fetchWithAuthRetry(`${API_URL}/api/v1/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const body = (await response.json()) as {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    throw new Error(
      userMessageFromApiError(
        response.status,
        body.error,
        "Password change failed. Please try again.",
      ),
    );
  }
}
