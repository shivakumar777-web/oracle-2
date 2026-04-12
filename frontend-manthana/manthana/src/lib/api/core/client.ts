/**
 * Core fetch utilities — shared across all section API clients.
 * Handles auth headers, content-type, and base fetch behavior.
 */

import { authClient } from "@/lib/auth-client";
import type { ApiEnvelope } from "./envelope";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await authClient.getSession();
    const session = data?.session;
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  } catch {
    return {};
  }
}

/**
 * Fetch with auth headers attached. Use for all API calls.
 * @param url - Full URL (section clients construct this)
 * @param init - Standard RequestInit
 */
export async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, v));
  return fetch(url, { ...init, headers });
}

/**
 * Fetch with auth and parse envelope. Throws on error status.
 * @param url - Full URL
 * @param options - RequestInit
 */
export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(url, options);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const envelope: ApiEnvelope<T> = await res.json();
  if (envelope.status === "error") throw new Error(envelope.error ?? "Unknown error");
  return envelope.data;
}
