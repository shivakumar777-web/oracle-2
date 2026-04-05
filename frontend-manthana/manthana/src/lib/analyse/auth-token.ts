/**
 * JWT for Manthana gateway (`Depends(verify_token)` on /analyze, /job/.../status, etc.).
 * Set after login: localStorage.setItem(MANTHANA_ACCESS_TOKEN_KEY, jwt)
 */
export const MANTHANA_ACCESS_TOKEN_KEY = "manthana_access_token";

/** Returns stored JWT, or null if missing / SSR. */
export function getGatewayAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(MANTHANA_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Persist token (e.g. after login callback). Pass null to clear. */
export function setGatewayAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(MANTHANA_ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(MANTHANA_ACCESS_TOKEN_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

/** Headers with Authorization when a token exists (for fetch). */
export function gatewayAuthHeaders(
  extra?: HeadersInit
): HeadersInit {
  const token = getGatewayAuthToken();
  const base: Record<string, string> = {};
  if (token) {
    base.Authorization = `Bearer ${token}`;
  }
  if (!extra) return base;
  if (extra instanceof Headers) {
    const out = new Headers(extra);
    if (token) out.set("Authorization", `Bearer ${token}`);
    return out;
  }
  return { ...base, ...(extra as Record<string, string>) };
}
