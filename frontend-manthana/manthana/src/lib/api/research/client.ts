/**
 * Research section API client.
 * Deep research, originality/plagiarism check.
 */

import { fetchWithAuth } from "../core/client";
import { RESEARCH_BASE, API_ORIGIN } from "../config";
import type {
  DeepResearchRequest,
  DeepResearchResult,
  DeepResearchStreamEvent,
  PlagiarismResult,
} from "./types";

export type {
  DeepResearchRequest,
  DeepResearchResult,
  DeepResearchStreamEvent,
  PlagiarismMatch,
  PlagiarismResult,
} from "./types";

const MOCK_PLAGIARISM: PlagiarismResult = {
  originalityScore: 91,
  matchedPercent: 9,
  matches: [
    {
      matchedSentence:
        "Homogeneous opacification noted in the right lower lobe with air bronchograms, consistent with airspace disease.",
      source: "Franquet T. Radiology 2001;218(1)",
      url: "https://pubmed.ncbi.nlm.nih.gov/11172015/",
      matchPercent: 5.2,
      isCitation: true,
    },
    {
      matchedSentence: "Community-acquired pneumonia management: current concepts.",
      source: "UpToDate — Pneumonia",
      url: "https://www.uptodate.com/contents/pneumonia",
      matchPercent: 3.8,
      isCitation: true,
    },
  ],
  sentencesAnalysed: 24,
  sourcesSearched: 7,
  layers: { webSearch: 2, vectorDB: 0 },
  scanDate: new Date().toISOString(),
  note: "Mock mode — backend offline. Run docker-compose up.",
};

/**
 * POST /deep-research — structured research with citations.
 */
export async function deepResearch(body: DeepResearchRequest): Promise<DeepResearchResult> {
  const res = await fetchWithAuth(`${RESEARCH_BASE}/deep-research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Deep research failed: ${res.status}`);
  const envelope = await res.json();
  const data = envelope?.data ?? envelope;
  if (!data) throw new Error("Invalid deep research response");
  return data as DeepResearchResult;
}

/**
 * POST /deep-research/stream — SSE (text/event-stream).
 * Assembles {@link DeepResearchResult} from section / citations / followup / done events.
 */
export async function deepResearchStream(
  body: DeepResearchRequest,
  onEvent: (ev: DeepResearchStreamEvent) => void,
): Promise<DeepResearchResult> {
  const res = await fetchWithAuth(`${RESEARCH_BASE}/deep-research/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Deep research stream failed: ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const sections: DeepResearchResult["sections"] = [];
  let citations: DeepResearchResult["citations"] = [];
  let followup_questions: string[] = [];
  let streamError: string | null = null;
  let meta: {
    sources_searched: number;
    time_taken_seconds: number;
    integrative_mode: boolean;
    request_id?: string;
    citation_style?: string;
    provider_used?: string;
  } = {
    sources_searched: 0,
    time_taken_seconds: 0,
    integrative_mode: false,
  };

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
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        const ev = JSON.parse(raw) as DeepResearchStreamEvent;
        onEvent(ev);
        if (ev.type === "error") {
          streamError = ev.message;
        }
        if (ev.type === "section") {
          sections.push({
            id: ev.id,
            title: ev.title,
            content: ev.content,
          });
        } else if (ev.type === "citations") {
          citations = ev.data;
        } else if (ev.type === "followup") {
          followup_questions = ev.questions;
        } else if (ev.type === "done") {
          meta = ev.meta;
        }
      } catch {
        /* ignore malformed chunk */
      }
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }

  const generated_at = new Date().toISOString();
  const citation_style =
    meta.citation_style ?? body.citation_style;
  return {
    query: body.query,
    domains_consulted: body.domains,
    subdomains_consulted: body.subdomains,
    intent: body.intent ?? "clinical",
    sections,
    citations,
    sources_searched: meta.sources_searched,
    time_taken_seconds: meta.time_taken_seconds,
    generated_at,
    integrative_mode: meta.integrative_mode,
    followup_questions,
    citation_style,
    provider_used: meta.provider_used,
  };
}

/**
 * POST /plagiarism/check — originality check.
 */
export async function checkOriginality(
  text: string,
  scanId: string
): Promise<PlagiarismResult> {
  try {
    const res = await fetchWithAuth(`${RESEARCH_BASE}/plagiarism/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, scanId }),
    });
    if (!res.ok) throw new Error("Originality check failed");
    const envelope = await res.json();
    return (envelope.data ?? envelope) as PlagiarismResult;
  } catch (err) {
    const isLocal = typeof window !== "undefined" && API_ORIGIN.startsWith("http://localhost");
    if (isLocal) {
      console.warn(
        "[Manthana] Originality backend offline — returning mock plagiarism result",
        err
      );
      await new Promise((r) => setTimeout(r, 4000));
      return MOCK_PLAGIARISM;
    }
    throw err;
  }
}
