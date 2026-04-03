"use client";

import { useState, useCallback, useRef } from "react";
import { useLang } from "@/components/LangProvider";
import {
  CitationStyle,
  DepthLevel,
  OutputFormat,
  RESEARCH_DOMAINS,
} from "@/lib/deep-research-config";
import { useDomainSources } from "@/contexts/DomainSourcesContext";
import { getUniversalSources } from "@/lib/universal-search-sources";
import {
  createResearchThread,
  deepResearchStream,
  type DeepResearchStreamEvent,
  type ResearchThread,
} from "@/lib/api";

const ALL_TRADITION_IDS = RESEARCH_DOMAINS.map((d) => d.id);

const HISTORY_KEY = "manthana_deep_research_history";

export interface DeepResearchHistoryEntry {
  id: string;
  timestamp: string;
  query: string;
  selectedDomains: string[];
  selectedSubdomains: Record<string, string[]>;
  researchIntent: string | null;
  depth: DepthLevel;
  depthSeconds: number;
  sourceFilters: string[];
  outputFormat: OutputFormat;
  citationStyle: CitationStyle;
  preview?: string;
}

export interface ActivityLogEntry {
  id: string;
  text: string;
  status: "pending" | "active" | "done";
  timestamp: number;
  /** Optimistic filler when SSE log is sparse */
  simulated?: boolean;
}

export interface Citation {
  id: number;
  authors: string;
  title: string;
  journal?: string;
  year?: number;
  doi?: string;
  pmid?: string;
  url?: string;
  tradition?: string;
}

export interface ResearchSection {
  id: string;
  title: string;
  content: string;
  icon?: string;
}

export interface DeepResearchResult {
  query: string;
  domains_consulted: string[];
  subdomains_consulted: string[];
  intent: string;
  sections: ResearchSection[];
  citations: Citation[];
  sources_searched: number;
  time_taken_seconds: number;
  generated_at: string;
  integrative_mode: boolean;
  followup_questions?: string[];
  citation_style?: string;
  /** LLM provider used for synthesis (stream meta or REST). */
  provider_used?: string;
}

export interface DeepResearchState {
  selectedDomains: string[];
  selectedSubdomains: Record<string, string[]>;
  researchIntent: string | null;
  depth: DepthLevel;
  depthSeconds: number;
  /** @deprecated Sources are now automatically selected based on domains (Universal Search) */
  sourceFilters: string[];
  outputFormat: OutputFormat;
  citationStyle: CitationStyle;
  query: string;
  isResearching: boolean;
  activityLog: ActivityLogEntry[];
  result: DeepResearchResult | null;
  error: string | null;
  /**
   * Step mapping (Subdomains are inline within Domain cards, not a separate step):
   * 1 → Domain
   * 2 → Intent
   * 3 → Depth
   * 4 → Research Results
   */
  activeStep: 1 | 2 | 3 | 4;
}

export function useDeepResearch() {
  const { lang } = useLang();
  const { config: domainSourcesConfig } = useDomainSources();

  const resolveSources = useCallback(
    (domains: string[]) =>
      getUniversalSources(
        domains,
        domainSourcesConfig?.domain_auto_sources,
        domainSourcesConfig?.integrative_core,
      ),
    [domainSourcesConfig],
  );
  const [state, setState] = useState<DeepResearchState>({
    selectedDomains: [],
    selectedSubdomains: {},
    researchIntent: null,
    depth: "comprehensive",
    depthSeconds: 60,
    sourceFilters: [],
    outputFormat: "structured",
    citationStyle: "vancouver",
    query: "",
    isResearching: false,
    activityLog: [],
    result: null,
    error: null,
    activeStep: 1,
  });

  const logTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const toggleDomain = useCallback((domainId: string) => {
    setState((prev) => {
      const selected = prev.selectedDomains.includes(domainId)
        ? prev.selectedDomains.filter((d) => d !== domainId)
        : [...prev.selectedDomains, domainId];
      return {
        ...prev,
        selectedDomains: selected,
        sourceFilters: resolveSources(selected),
        // Subdomains are chosen inline within the domain cards,
        // so the wizard stays on Step 1 until an intent is chosen.
        activeStep: selected.length > 0 ? 1 : 1,
      };
    });
  }, [resolveSources]);

  /** Select all five medical traditions (same coverage intent as Oracle M5, but cited Deep Research pipeline). */
  const selectAllDomains = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedDomains: [...ALL_TRADITION_IDS],
      sourceFilters: resolveSources([...ALL_TRADITION_IDS]),
      activeStep: 1,
    }));
  }, [resolveSources]);

  const clearDomainSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedDomains: [],
      selectedSubdomains: {},
      sourceFilters: [],
      activeStep: 1,
    }));
  }, []);

  const toggleSubdomain = useCallback(
    (domainId: string, subdomainId: string) => {
      setState((prev) => {
        const current = prev.selectedSubdomains[domainId] || [];
        const updated = current.includes(subdomainId)
          ? current.filter((s) => s !== subdomainId)
          : current.length < 3
          ? [...current, subdomainId]
          : current;
        return {
          ...prev,
          selectedSubdomains: {
            ...prev.selectedSubdomains,
            [domainId]: updated,
          },
        };
      });
    },
    [],
  );

  const setIntent = useCallback((intentId: string) => {
    setState((prev) => ({
      ...prev,
      researchIntent: intentId,
      activeStep: 2,
    }));
  }, []);

  const updateDepth = useCallback((depth: DepthLevel) => {
    setState((prev) => ({
      ...prev,
      depth,
      activeStep: 3,
    }));
  }, []);

  const updateDepthSeconds = useCallback((seconds: number) => {
    setState((prev) => ({
      ...prev,
      depthSeconds: seconds,
    }));
  }, []);

  /**
   * @deprecated Source selection is now automatic via Universal Search.
   * Sources are determined by selected domains in toggleDomain.
   */
  const toggleSource = useCallback((_sourceId: string) => {
    // No-op: Universal Search automatically manages sources based on domains
    console.debug("[Universal Search] Manual source toggling deprecated - sources auto-selected by domain");
  }, []);

  const setOutputFormat = useCallback((format: OutputFormat) => {
    setState((prev) => ({ ...prev, outputFormat: format }));
  }, []);

  const setCitationStyle = useCallback((style: CitationStyle) => {
    setState((prev) => ({ ...prev, citationStyle: style }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, query }));
  }, []);

  const loadTemplate = useCallback(
    (template: import("@/lib/deep-research-config").ResearchTemplate) => {
      setState((prev) => ({
        ...prev,
        selectedDomains: template.domains,
        selectedSubdomains: template.subdomains,
        researchIntent: template.intent,
        depth: template.depth,
        // Universal Search: sources auto-derived from domains, template.sources ignored
        sourceFilters: resolveSources(template.domains),
        citationStyle: template.citationStyle,
        query: template.sampleQuery,
        activeStep: 3,
      }));
    },
    [resolveSources],
  );

  const runResearch = useCallback(async () => {
    if (!state.query.trim() || state.selectedDomains.length === 0) return;

    logTimersRef.current.forEach(clearTimeout);
    logTimersRef.current = [];

    setState((prev) => ({
      ...prev,
      isResearching: true,
      activityLog: [],
      result: null,
      error: null,
    }));

    let logCounter = 0;
    const nextLogId = () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `log-${++logCounter}-${Date.now()}`;

    try {
      const flatSubdomains = Object.values(state.selectedSubdomains).flat();
      const deepFlag = state.depth === "focused" ? false : true;
      const data = await deepResearchStream(
        {
          query: state.query,
          domains: state.selectedDomains,
          subdomains: flatSubdomains,
          subdomain_map: state.selectedSubdomains,
          intent: state.researchIntent,
          depth: state.depth,
          sources: state.sourceFilters,
          output_format: state.outputFormat,
          citation_style: state.citationStyle,
          lang: lang || "en",
          deep: deepFlag,
          target_seconds: state.depthSeconds,
        },
        (ev: DeepResearchStreamEvent) => {
          if (ev.type === "log") {
            setState((prev) => ({
              ...prev,
              activityLog: [
                ...prev.activityLog.map((e) => ({
                  ...e,
                  status: "done" as const,
                })),
                {
                  id: nextLogId(),
                  text: ev.text,
                  status: "active" as const,
                  timestamp: Date.now(),
                  simulated: false,
                },
              ],
            }));
          }
        },
      );

      const preview =
        data.sections[0]?.content?.slice(0, 220) ?? data.query.slice(0, 220);
      try {
        if (typeof window !== "undefined") {
          const entry: DeepResearchHistoryEntry = {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `dr-${Date.now()}`,
            timestamp: new Date().toISOString(),
            query: state.query,
            selectedDomains: state.selectedDomains,
            selectedSubdomains: state.selectedSubdomains,
            researchIntent: state.researchIntent,
            depth: state.depth,
            depthSeconds: state.depthSeconds,
            sourceFilters: state.sourceFilters,
            outputFormat: state.outputFormat,
            citationStyle: state.citationStyle,
            preview,
          };
          const raw = window.localStorage.getItem(HISTORY_KEY);
          const list: DeepResearchHistoryEntry[] = raw ? JSON.parse(raw) : [];
          list.unshift(entry);
          window.localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(list.slice(0, 50)),
          );
          window.dispatchEvent(new Event("deep-research-history-updated"));
        }
      } catch {
        /* ignore storage errors */
      }

      setState((prev) => ({
        ...prev,
        isResearching: false,
        result: data as DeepResearchResult,
        activityLog: prev.activityLog.map((e) => ({
          ...e,
          status: "done" as const,
        })),
        activeStep: 4,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isResearching: false,
        error:
          err instanceof Error
            ? err.message
            : "Research failed. Please try again.",
      }));
    }
  }, [state, lang, resolveSources]);

  const restoreResearchSession = useCallback(
    (entry: DeepResearchHistoryEntry) => {
      setState((prev) => ({
        ...prev,
        query: entry.query,
        selectedDomains: entry.selectedDomains,
        selectedSubdomains: entry.selectedSubdomains,
        researchIntent: entry.researchIntent,
        depth: entry.depth,
        depthSeconds: entry.depthSeconds,
        sourceFilters: entry.sourceFilters,
        outputFormat: entry.outputFormat,
        citationStyle: entry.citationStyle,
        activeStep: 3,
        result: null,
        error: null,
      }));
    },
    [],
  );

  const reset = useCallback(() => {
    logTimersRef.current.forEach(clearTimeout);
    setState({
      selectedDomains: [],
      selectedSubdomains: {},
      researchIntent: null,
      depth: "comprehensive",
      depthSeconds: 60,
      sourceFilters: [],
      outputFormat: "structured",
      citationStyle: "vancouver",
      query: "",
      isResearching: false,
      activityLog: [],
      result: null,
      error: null,
      activeStep: 1,
    });
  }, []);

  const saveCurrentResultToServer = useCallback(async () => {
    if (!state.result) {
      throw new Error("No result to save");
    }
    await createResearchThread({
      title: state.query.trim().slice(0, 120) || state.result.query.slice(0, 120),
      query: state.query.trim() || state.result.query,
      settings: {
        domains: state.selectedDomains,
        subdomains: state.selectedSubdomains,
        intent: state.researchIntent,
        depth: state.depth,
        depthSeconds: state.depthSeconds,
        sources: state.sourceFilters,
        outputFormat: state.outputFormat,
        citationStyle: state.citationStyle,
        lang,
      },
      result: state.result as unknown as Record<string, unknown>,
    });
  }, [state, lang]);

  /** Restore wizard + optional result from GET /research/threads (saved payload). */
  const restoreFromServerThread = useCallback((thread: ResearchThread) => {
    const raw = (thread.settings ?? {}) as Record<string, unknown>;
    const domains = Array.isArray(raw.domains) ? (raw.domains as string[]) : [];
    const subdomains =
      raw.subdomains &&
      typeof raw.subdomains === "object" &&
      !Array.isArray(raw.subdomains)
        ? (raw.subdomains as Record<string, string[]>)
        : {};
    const intent =
      typeof raw.intent === "string" || raw.intent === null
        ? (raw.intent as string | null)
        : null;
    const depthCandidates = ["focused", "comprehensive", "exhaustive"] as const;
    const depth = depthCandidates.includes(
      raw.depth as (typeof depthCandidates)[number],
    )
      ? (raw.depth as DepthLevel)
      : "comprehensive";
    const depthSeconds =
      typeof raw.depthSeconds === "number" && raw.depthSeconds > 0
        ? raw.depthSeconds
        : 60;
    const savedSources = Array.isArray(raw.sources)
      ? (raw.sources as string[])
      : [];
    const sourceFilters =
      savedSources.length > 0 ? savedSources : resolveSources(domains);
    const of = raw.outputFormat;
    const outputFormat: OutputFormat =
      of === "summary" || of === "bullets" || of === "structured"
        ? of
        : "structured";
    const cs = raw.citationStyle;
    const citationStyle: CitationStyle =
      cs === "vancouver" ||
      cs === "apa" ||
      cs === "mla" ||
      cs === "icmr" ||
      cs === "harvard"
        ? cs
        : "vancouver";
    const rawResult = thread.result;
    const result =
      rawResult &&
      typeof rawResult === "object" &&
      Array.isArray((rawResult as { sections?: unknown }).sections)
        ? (rawResult as unknown as DeepResearchResult)
        : null;

    setState((prev) => ({
      ...prev,
      query: thread.query,
      selectedDomains: domains,
      selectedSubdomains: subdomains,
      researchIntent: intent,
      depth,
      depthSeconds,
      sourceFilters,
      outputFormat,
      citationStyle,
      result,
      error: null,
      isResearching: false,
      activityLog: [],
      activeStep: result ? 4 : 3,
    }));
  }, [resolveSources]);

  return {
    state,
    toggleDomain,
    selectAllDomains,
    clearDomainSelection,
    toggleSubdomain,
    setIntent,
    updateDepth,
    updateDepthSeconds,
    toggleSource,
    setOutputFormat,
    setCitationStyle,
    setQuery,
    loadTemplate,
    runResearch,
    restoreResearchSession,
    reset,
    saveCurrentResultToServer,
    restoreFromServerThread,
  };
}

