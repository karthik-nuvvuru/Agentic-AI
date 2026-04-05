const API = import.meta.env.VITE_API_BASE || "";

const ACCESS_KEY = "auth_access_token";

export interface Tokens {
  access_token: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string | null;
  [key: string]: unknown;
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

/* ── Access token helpers (sessionStorage for XSS mitigation) ── */
export function setAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_KEY, token);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_KEY);
}

/* ── Backward-compatible aliases (old names → new impl) ── */
export const setTokens = setAccessToken;
export const clearTokens = clearAccessToken;
export const getTokens = (): Tokens | null => {
  const t = getAccessToken();
  return t ? { access_token: t } : null;
};

export function getAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/* ── Refresh — reads httpOnly cookie, server returns new pair ── */
export async function refreshSession(): Promise<Tokens | null> {
  try {
    const res = await fetch(`${API}/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      clearAccessToken();
      return null;
    }
    const data = await res.json();
    setAccessToken(data.access_token);
    return { access_token: data.access_token };
  } catch {
    clearAccessToken();
    return null;
  }
}

/* ── Logout ── */
export async function logout(): Promise<void> {
  clearAccessToken();
  await fetch(`${API}/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}
