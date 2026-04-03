/**
 * Unified/gateway-level API functions.
 * Used when no section-specific backend exists (health, me, categories, query).
 */

import { fetchWithAuth, fetchApi } from "../core/client";
import { API_BASE, API_ORIGIN } from "../config";
import type { ApiEnvelope } from "../core/envelope";

export interface QueryResponse {
  answer: string;
  sources?: { title: string; url: string; domain?: string; relevance?: number }[];
  confidence?: number;
}

export interface HealthService {
  status: "healthy" | "degraded" | "down";
  latency_ms?: number;
  last_check?: string;
}

export interface HealthResponse {
  overall: string;
  services: Record<string, HealthService>;
}

const MOCK_HEALTH: HealthResponse = {
  overall: "operational",
  services: {
    radiology: { status: "healthy", latency_ms: 142 },
    ecg: { status: "healthy", latency_ms: 88 },
    ayurveda: { status: "healthy", latency_ms: 201 },
    nlp: { status: "healthy", latency_ms: 65 },
    cancer: { status: "degraded", latency_ms: 890 },
    drug: { status: "healthy", latency_ms: 112 },
    eye: { status: "healthy", latency_ms: 178 },
    brain: { status: "down", latency_ms: undefined },
  },
};

/**
 * GET /health — service health status.
 */
export async function getHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${API_ORIGIN}/health`);
    if (!res.ok) throw new Error(`Health ${res.status}`);
    const envelope = await res.json();
    if (envelope.status === "error") throw new Error(envelope.error ?? "Health error");
    const raw = envelope.data as { router?: string; services?: Record<string, string> };
    const services: Record<string, HealthService> = {};
    for (const [k, v] of Object.entries(raw?.services ?? {})) {
      const status = v === "online" ? "healthy" : v === "degraded" ? "degraded" : "down";
      services[k] = { status };
    }
    return {
      overall: raw?.router === "online" ? "operational" : "degraded",
      services,
    };
  } catch {
    return MOCK_HEALTH;
  }
}

/**
 * GET /me — current user from JWT (Better Auth).
 */
export async function getMe(): Promise<{ user: Record<string, unknown> | null }> {
  return fetchApi<{ user: Record<string, unknown> | null }>(`${API_BASE}/me`);
}

/**
 * GET /categories — available search categories.
 */
export async function getCategories(): Promise<string[]> {
  try {
    const data = await fetchApi<{ categories: string[] }>(`${API_BASE}/categories`);
    return data.categories;
  } catch {
    return ["medical", "research", "ayurveda", "allopathy", "drug", "guidelines"];
  }
}

/**
 * POST /query — single-shot RAG.
 */
export async function postQuery(
  query: string,
  options?: { domains?: string[]; deep?: boolean }
): Promise<QueryResponse> {
  const res = await fetchWithAuth(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      domain: options?.domains?.[0] ?? "allopathy",
      domains: options?.domains ?? ["allopathy"],
      deep: options?.deep ?? false,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const envelope: ApiEnvelope<QueryResponse> = await res.json();
  if (envelope.status === "error") throw new Error(envelope.error ?? "Unknown error");
  return envelope.data;
}
