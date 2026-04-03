/**
 * Research thread persistence — POST/GET/PATCH/DELETE /v1/research/threads
 */

import { fetchWithAuth } from "../core/client";
import { RESEARCH_BASE } from "../config";

export interface ResearchThread {
  id: string;
  user_sub: string | null;
  title: string;
  query: string;
  settings: Record<string, unknown>;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateThreadBody {
  title?: string;
  query: string;
  settings?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
}

export async function listResearchThreads(limit = 50): Promise<ResearchThread[]> {
  const res = await fetchWithAuth(
    `${RESEARCH_BASE}/research/threads?limit=${encodeURIComponent(String(limit))}`,
    { method: "GET" },
  );
  if (!res.ok) throw new Error(`List threads failed: ${res.status}`);
  const envelope = await res.json();
  const data = envelope?.data ?? envelope;
  return (data?.threads ?? []) as ResearchThread[];
}

export async function createResearchThread(
  body: CreateThreadBody,
): Promise<ResearchThread> {
  const res = await fetchWithAuth(`${RESEARCH_BASE}/research/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: body.title ?? "",
      query: body.query,
      settings: body.settings ?? {},
      result: body.result ?? null,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Save thread failed: ${res.status} ${errText.slice(0, 200)}`);
  }
  const envelope = await res.json();
  const data = envelope?.data ?? envelope;
  if (!data?.id) throw new Error("Invalid create thread response");
  return data as ResearchThread;
}

export async function deleteResearchThread(threadId: string): Promise<void> {
  const res = await fetchWithAuth(
    `${RESEARCH_BASE}/research/threads/${encodeURIComponent(threadId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`Delete thread failed: ${res.status}`);
}
