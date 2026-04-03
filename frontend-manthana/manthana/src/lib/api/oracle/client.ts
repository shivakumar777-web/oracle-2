/**
 * Oracle section API client.
 * Chat streaming, M5 five-domain mode.
 * No fallback to search — Oracle is self-contained per Section Separation plan.
 */

import { fetchWithAuth } from "../core/client";
import { ORACLE_BASE } from "../config";
import type {
  ChatModes,
  StreamSource,
  ChatResponse,
  M5DomainAnswer,
  M5Summary,
} from "./types";

export type { ChatModes, StreamSource, ChatResponse, M5DomainAnswer, M5Summary } from "./types";

/**
 * Streaming chat backed by POST /chat.
 * Supports intensity, persona, evidence, enable_web, enable_trials.
 */
export async function streamChat(
  message: string,
  history: { role: string; content: string }[],
  domain: string,
  lang: string,
  modes: ChatModes,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onProgress?: (stage: string, status: string) => void,
  onSources?: (sources: StreamSource[]) => void,
  onEmergency?: () => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const ctrl = signal ? null : new AbortController();
    const timeout = ctrl ? setTimeout(() => ctrl!.abort(), 60_000) : null;
    const res = await fetchWithAuth(`${ORACLE_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        domain: domain || "allopathy",
        lang: lang || "en",
        intensity: modes.intensity,
        persona: modes.persona,
        evidence: modes.evidence,
        enable_web: modes.enable_web ?? true,
        enable_trials: modes.enable_trials ?? false,
      }),
      signal: signal ?? ctrl!.signal,
    });
    if (timeout) clearTimeout(timeout);

    if (!res.ok) throw new Error(`API ${res.status}`);

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream") && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const evtType = parsed?.type;
            if (evtType === "progress" && onProgress) {
              onProgress(parsed.stage ?? "", parsed.status ?? "");
            } else if (evtType === "sources" && onSources && Array.isArray(parsed.sources)) {
              onSources(parsed.sources);
            } else if (evtType === "emergency" && parsed?.is_emergency) {
              onEmergency?.();
              onProgress?.("emergency", "detected");
            } else if (evtType === "done") {
              // Handled below
            } else {
              const token = parsed?.message?.content ?? "";
              if (token) onChunk(token);
            }
          } catch {
            if (payload) onChunk(payload);
          }
        }
      }
      onDone();
      return;
    }

    // Fallback: JSON response — simulate streaming
    const data = await res.json();
    const rawData = data.data ?? data;
    const answer =
      rawData.answer ||
      rawData.synthesis ||
      rawData.response ||
      (rawData.results?.length
        ? rawData.results
            .slice(0, 3)
            .map(
              (r: { title?: string; content?: string }, i: number) =>
                `${i + 1}. **${r.title ?? "Result"}**\n${(r.content ?? "").slice(0, 300)}...`
            )
            .join("\n\n")
        : "No results found.");

    const words = answer.split(" ");
    for (let i = 0; i < words.length; i++) {
      await new Promise((r) => setTimeout(r, 18));
      onChunk(words[i] + (i < words.length - 1 ? " " : ""));
    }
    onDone();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    console.error("[Manthana Oracle] streamChat error:", err);
    onChunk("Unable to connect to Manthana AI. Please try again.");
    onDone();
  }
}

/**
 * M5 five-domain streaming chat.
 */
export async function streamM5(
  message: string,
  history: { role: string; content: string }[],
  lang: string,
  onDomainAnswer: (answer: M5DomainAnswer) => void,
  onSummary: (summary: M5Summary) => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const ctrl = signal ? null : new AbortController();
    const timeout = ctrl ? setTimeout(() => ctrl!.abort(), 120_000) : null;
    const res = await fetchWithAuth(`${ORACLE_BASE}/chat/m5`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        lang: lang || "en",
      }),
      signal: signal ?? ctrl!.signal,
    });
    if (timeout) clearTimeout(timeout);

    if (!res.ok) throw new Error(`API ${res.status}`);

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream") && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const evtType = parsed?.type;
            if (evtType === "m5_domain") {
              onDomainAnswer({
                domain: parsed.domain,
                domain_name: parsed.domain_name,
                icon: parsed.icon,
                color: parsed.color,
                tagline: parsed.tagline,
                content: parsed.content,
                sources: parsed.sources || [],
                confidence: parsed.confidence || 85,
                key_concepts: parsed.key_concepts || [],
                treatment_approach: parsed.treatment_approach || "",
                evidence_level: parsed.evidence_level || "",
              });
            } else if (evtType === "m5_summary") {
              onSummary({ content: parsed.content });
            }
          } catch {
            // Skip malformed events
          }
        }
      }
      onDone();
      return;
    }

    throw new Error("M5 response was not streaming");
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    console.error("[Manthana Oracle] streamM5 error:", err);
    throw err;
  }
}
