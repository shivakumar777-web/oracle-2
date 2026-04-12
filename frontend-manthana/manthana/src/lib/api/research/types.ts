/**
 * Research section — deep research types.
 */

export interface DeepResearchRequest {
  query: string;
  domains: string[];
  subdomains: string[];
  /** Per-domain subdomain ids (preferred over flat subdomains). */
  subdomain_map?: Record<string, string[]>;
  intent: string | null;
  depth: string;
  sources: string[];
  output_format: string;
  citation_style: string;
  lang: string;
  /** Decomposition + scoring when true; focused depth forces fast path server-side. */
  deep: boolean;
  /** Optional wall-clock cap (seconds), e.g. depth slider */
  target_seconds?: number;
}

export interface DeepResearchResult {
  query: string;
  domains_consulted: string[];
  subdomains_consulted: string[];
  intent: string;
  sections: Array<{ id: string; title: string; content: string }>;
  citations: Array<{
    id: number;
    authors: string;
    title: string;
    journal?: string;
    year?: number;
    doi?: string;
    pmid?: string;
    url?: string;
  }>;
  sources_searched: number;
  time_taken_seconds: number;
  generated_at: string;
  integrative_mode: boolean;
  followup_questions?: string[];
  /** Style used for this run (mirrors request + stream done meta). */
  citation_style?: string;
  provider_used?: string;
}

/** SSE payloads from POST /deep-research/stream */
export type DeepResearchStreamEvent =
  | { type: "log"; text: string }
  | { type: "section"; id: string; title: string; content: string }
  | {
      type: "citations";
      data: DeepResearchResult["citations"];
    }
  | { type: "followup"; questions: string[] }
  | {
      type: "done";
      meta: {
        sources_searched: number;
        time_taken_seconds: number;
        integrative_mode: boolean;
        request_id?: string;
        citation_style?: string;
        provider_used?: string;
      };
    }
  | { type: "error"; message: string };
