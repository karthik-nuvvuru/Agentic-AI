const API = import.meta.env.VITE_API_BASE || "";

const ACCESS_KEY = "auth_access_token";
const REFRESH_KEY = "auth_refresh_token";

export interface Tokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export function setTokens(access_token: string, refresh_token: string): void {
  localStorage.setItem(ACCESS_KEY, access_token);
  localStorage.setItem(REFRESH_KEY, refresh_token);
}

export function getTokens(): Tokens | null {
  const access_token = localStorage.getItem(ACCESS_KEY);
  const refresh_token = localStorage.getItem(REFRESH_KEY);
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const tokens = getTokens();
  if (!tokens) return {};
  return { Authorization: `Bearer ${tokens.access_token}` };
}

export async function refreshSession(): Promise<Tokens | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  try {
    const res = await fetch(`${API}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data: AuthResponse = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return { access_token: data.access_token, refresh_token: data.refresh_token };
  } catch {
    clearTokens();
    return null;
  }
}
