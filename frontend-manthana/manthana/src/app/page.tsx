"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import SearchBar from "@/components/SearchBar";
import DomainPills from "@/components/DomainPills";
import ChatMessage, { ChatMessageData } from "@/components/ChatMessage";
import ChurningState from "@/components/ChurningState";
import InlineTriggerBanner from "@/components/InlineTriggerBanner";
import { streamChat, streamM5, searchMedical, fetchSearchWithSources } from "@/lib/api";
import type { SearchResponse, M5DomainAnswer, M5Summary, StreamSource } from "@/lib/api";
import ManthanWebResults from "@/components/ManthanWebResults";
import { useLang } from "@/components/LangProvider";
import { useToast } from "@/hooks/useToast";
import { isManthanaWebLocked } from "@/lib/manthana-web-locked";
import { useProductAccess } from "@/components/ProductAccessProvider";
import {
  consumeOracleLabsHandoff,
  ORACLE_LABS_HANDOFF_QUERY,
} from "@/lib/analyse/oracle-handoff";


export default function OraclePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [mode, setMode] = useState(() => {
    const m = searchParams.get("mode");
    if (m === "analysis") return "auto";
    if (isManthanaWebLocked() && m === "search") return "auto";
    if (m) return m;
    if (pathname.startsWith("/deep-research")) return "deep-research";
    if (searchParams.get("domain") === "m5") return "m5";
    return "auto";
  });
  const [activeDomain, setActiveDomain] = useState<string>(
    () => {
      const d = searchParams.get("domain");
      if (d) return d;
      if (searchParams.get("mode") === "m5") return "m5";
      return "allopathy";
    }
  );
  
  // Mode selector state for Oracle chat customization
  const [intensity, setIntensity] = useState<string>("auto");
  const [persona, setPersona] = useState<string>("auto");
  const [evidence, setEvidence] = useState<string>("auto");
  
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isEmergencyResponse, setIsEmergencyResponse] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchPage, setSearchPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [sessionId] = useState<string>(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Date.now().toString()
  );
  const [pendingBanner, setPendingBanner] = useState<
    | { type: "drug"; drugs: string[]; query: string }
    | { type: "herb"; herb: string; drug?: string; query: string }
    | null
  >(null);

  const hasMessages = messages.length > 0;
  const { lang } = useLang();
  const { addToast } = useToast();
  const access = useProductAccess();
  const oracleLimited =
    !access.loading && access.oracleTier === "limited";
  const webLocked = isManthanaWebLocked();

  const labsHandoffFlag = searchParams.get(ORACLE_LABS_HANDOFF_QUERY);
  const labsHandoffConsumedRef = useRef(false);

  const reserveOracleSlot = async (): Promise<boolean> => {
    if (!oracleLimited) return true;
    const res = await fetch("/api/me/oracle-consume", { method: "POST" });
    if (res.status === 429) {
      const j = (await res.json().catch(() => ({}))) as { cap?: number };
      addToast(
        `Daily Oracle limit reached (${j.cap ?? access.oracleDailyCap} messages). Upgrade to PRO for clinical depth, Manthana Web, and full Labs.`,
        "error",
        9000
      );
      return false;
    }
    void access.refetch();
    return true;
  };

  useEffect(() => {
    if (searchParams.get("labsLocked") !== "1") return;
    addToast(
      "Manthana Labs: your 3 free trial scans are used up, or you need an active PRO plan. Open Plans to upgrade.",
      "warning",
      10000
    );
    router.replace("/", { scroll: false });
  }, [searchParams, router, addToast]);

  useEffect(() => {
    if (access.loading || access.oracleTier === "full") return;
    setIntensity((i) => (i === "clinical" || i === "deep" ? "quick" : i));
    // Free tier: keep M5; still reset Web / Deep Research-only modes.
    setMode((m) => (m === "search" || m === "deep-research" ? "auto" : m));
  }, [access.loading, access.oracleTier]);

  // Manthana Labs → Oracle: load one-shot report context from sessionStorage (?labsHandoff=1)
  useEffect(() => {
    if (labsHandoffFlag !== "1" || access.loading || labsHandoffConsumedRef.current) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete(ORACLE_LABS_HANDOFF_QUERY);
    const qs = params.toString();
    const cleanPath = qs ? `/?${qs}` : "/";

    const payload = consumeOracleLabsHandoff();
    labsHandoffConsumedRef.current = true;

    if (!payload) {
      router.replace(cleanPath, { scroll: false });
      return;
    }

    const msgId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `labs-${Date.now()}`;

    setMessages([
      {
        id: msgId,
        role: "user",
        content: payload.reportMarkdown,
      },
    ]);
    setQuery(payload.suggestedFollowUp);
    setSearchResults(null);
    setMode("m5");
    setActiveDomain("m5");
    setIntensity("clinical");
    setPersona("clinician");
    addToast(
      "Labs report loaded. M5 — All 5 is selected; adjust domain or intensity, then press send.",
      "success",
      9000
    );
    router.replace(cleanPath, { scroll: false });
  }, [
    labsHandoffFlag,
    access.loading,
    searchParams,
    router,
    addToast,
  ]);

  // Deep link ?mode=search while Web is locked → dedicated Coming Soon route
  useEffect(() => {
    if (!webLocked) return;
    if (searchParams.get("mode") === "search") {
      router.replace("/search");
    }
  }, [webLocked, searchParams, router]);

  const modeLabel = (m: string) => {
    if (m === "deep-research") return "MED DEEP RESEARCH";
    if (m === "search") return "MANTHANA WEB";
    if (m === "m5") return "M5 — FIVE DOMAINS";
    return "AUTO";
  };

  const domainLabel = (d: string) => {
    if (d === "ayurveda") return "Ayurveda";
    if (d === "homeopathy") return "Homeopathy";
    if (d === "siddha") return "Siddha";
    if (d === "unani") return "Unani";
    if (d === "m5") return "M5 — Five Domains";
    return "Allopathy";
  };

  const updateURL = (newMode: string, newDomain: string) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (newMode !== "auto") params.set("mode", newMode);
    if (newDomain !== "allopathy") params.set("domain", newDomain);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Abort any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Persist chat history to localStorage
  useEffect(() => {
    if (messages.length === 0) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("manthana_sessions");
      const sessions: {
        id: string;
        timestamp: string;
        domain: string;
        mode: string;
        messages: { id: string; role: string; content: string }[];
      }[] = raw ? JSON.parse(raw) : [];
      const payload = {
        id: sessionId,
        timestamp: new Date().toISOString(),
        domain: activeDomain,
        mode,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
      };
      const idx = sessions.findIndex((s) => s.id === sessionId);
      if (idx >= 0) {
        sessions[idx] = payload;
      } else {
        sessions.unshift(payload);
      }
      window.localStorage.setItem("manthana_sessions", JSON.stringify(sessions));
    } catch {
      // Ignore storage failures
    }
  }, [messages, sessionId, activeDomain, mode]);

  const detectDrugNames = (text: string): string[] => {
    const known = [
      "metoprolol",
      "atorvastatin",
      "aspirin",
      "warfarin",
      "clopidogrel",
      "metformin",
      "insulin",
      "amlodipine",
      "losartan",
      "omeprazole",
      "prednisone",
    ];
    const tokens = text.toLowerCase().split(/[^a-z0-9\-]+/);
    const found = new Set<string>();
    for (const t of tokens) {
      if (!t) continue;
      if (
        t.endsWith("olol") ||
        t.endsWith("pril") ||
        t.endsWith("statin") ||
        t.endsWith("mab") ||
        t.endsWith("nib") ||
        t.endsWith("mycin") ||
        known.includes(t)
      ) {
        found.add(t);
      }
    }
    return Array.from(found);
  };

  const detectHerbs = (text: string): string[] => {
    const herbs = [
      "ashwagandha",
      "turmeric",
      "curcumin",
      "brahmi",
      "arjuna",
      "tulsi",
      "triphala",
    ];
    const lower = text.toLowerCase();
    return herbs.filter((h) => lower.includes(h));
  };

  const coreSubmit = async (trimmed: string) => {
    if (access.loading) return;
    if (oracleLimited && mode === "search") {
      addToast("Manthana Web search requires PRO.", "warning");
      return;
    }

    const reserved = await reserveOracleSlot();
    if (!reserved) return;

    const userMsg: ChatMessageData = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    // Mode-specific behavior
    if (mode === "search") {
      if (webLocked) {
        router.push("/search");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      setIsThinking(true);
      setSearchResults(null);
      try {
        const res = await searchMedical(trimmed, {
          category: activeDomain,
          page: searchPage,
          lang: lang ?? "en",
        });
        setSearchResults(res);
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Search failed. Please try again.", "error");
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // M5 MODE — Query all 5 medical systems simultaneously
    if (mode === "m5") {
      setIsThinking(true);
      
      const assistantId = (Date.now() + 1).toString();
      const m5AnswersRef = { current: [] as M5DomainAnswer[] };
      const m5SummaryRef = { current: undefined as M5Summary | undefined };
      
      const assistantMsg: ChatMessageData = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        isM5: true,
        m5Query: trimmed,
        m5Answers: [],
        mode: "m5",
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Abort previous stream if any
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        await streamM5(
          trimmed,
          history,
          lang,
          (domainAnswer: M5DomainAnswer) => {
            // Add new domain answer
            m5AnswersRef.current = [...m5AnswersRef.current, domainAnswer];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, m5Answers: m5AnswersRef.current }
                  : m
              )
            );
          },
          (summary: M5Summary) => {
            m5SummaryRef.current = summary;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, m5Summary: summary }
                  : m
              )
            );
          },
          () => {
            // onDone
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      streaming: false,
                      m5Answers: m5AnswersRef.current,
                      m5Summary: m5SummaryRef.current,
                    }
                  : m
              )
            );
            setIsThinking(false);
          },
          abortRef.current.signal
        );
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        if (!isAbort) {
          addToast("M5 query failed. Please try again.", "error");
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        );
        setIsThinking(false);
      }
      return;
    }

    // AUTO / DEEP-RESEARCH — streaming chat via /chat
    setIsThinking(true);

    const assistantId = (Date.now() + 1).toString();
    setIsEmergencyResponse(false);
    const assistantMsg: ChatMessageData = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
      domains: [activeDomain],
      verified: true,
      mode,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Abort previous stream if any
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const streamSourcesRef = { current: null as { title: string; url: string; domain: string; trustScore?: number }[] | null };
    const streamWebLinksRef = { current: null as { title: string; url: string }[] | null };
    const streamContentRef = { current: "" };
    try {
      await streamChat(
        trimmed,
        history,
        activeDomain,
        lang,
        {
          intensity: oracleLimited
            ? "quick"
            : ((intensity === "deep" ? "clinical" : intensity) as
                | "auto"
                | "quick"
                | "clinical"
                | "deep"),
          persona: (oracleLimited
            ? "patient"
            : persona) as "auto" | "patient" | "clinician" | "researcher" | "student",
          evidence: (oracleLimited
            ? "gold"
            : evidence) as "auto" | "gold" | "all" | "guidelines" | "trials",
          enable_web: !oracleLimited,
          enable_trials: false,
        },
        (token: string) => {
          streamContentRef.current += token;
        },
        async () => {
          try {
            const content = streamContentRef.current;
            const srcs = streamSourcesRef.current;
            const webLinksPatch =
              streamWebLinksRef.current && streamWebLinksRef.current.length > 0
                ? { webSearchLinks: streamWebLinksRef.current }
                : {};

            if (srcs && srcs.length > 0) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content,
                        streaming: false,
                        sources: srcs,
                        sourcesCount: srcs.length,
                        confidence: Math.round(
                          srcs.reduce((a, s) => a + (s.trustScore ?? 70), 0) / srcs.length
                        ),
                        verified: true,
                        ...webLinksPatch,
                      }
                    : m
                )
              );
            } else if (!webLocked && !oracleLimited) {
              const rawData = await fetchSearchWithSources(
                trimmed,
                activeDomain,
                lang || "en",
              );
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content,
                        streaming: false,
                        sources: (rawData.sources ?? rawData.results ?? []).map(
                          (r: { title?: string; url?: string; source?: string }) => ({
                            title: r.title ?? r.source ?? "",
                            url: r.url ?? "",
                            domain: r.source ?? r.url ?? "",
                          }),
                        ),
                        sourcesCount:
                          rawData.sources?.length || rawData.results?.length || 0,
                        confidence: rawData.confidence || 88,
                        verified: true,
                        ...webLinksPatch,
                      }
                    : m
                )
              );
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content, streaming: false, ...webLinksPatch }
                    : m
                )
              );
            }
          } catch {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: streamContentRef.current,
                      streaming: false,
                      ...(streamWebLinksRef.current && streamWebLinksRef.current.length > 0
                        ? { webSearchLinks: streamWebLinksRef.current }
                        : {}),
                    }
                  : m
              )
            );
          } finally {
            setIsThinking(false);
          }
        },
        undefined,
        (sources: StreamSource[]) => {
          streamSourcesRef.current = sources.map((s) => ({
            title: s.title || s.id,
            url: s.url || "",
            domain: s.source || s.id,
            trustScore: s.trustScore,
          }));
        },
        (links) => {
          streamWebLinksRef.current = links;
        },
        () => setIsEmergencyResponse(true),
        abortRef.current.signal
      );
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "The ocean is turbulent. Please try again.",
                  streaming: false,
                }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: streamContentRef.current, streaming: false } : m
          )
        );
      }
      setIsThinking(false);
    }
  };

  const handleSubmit = async (val: string) => {
    if (!val.trim() || isThinking || access.loading) return;
    const trimmed = val.trim();

    const drugs = detectDrugNames(trimmed);
    const herbs = activeDomain === "ayurveda" ? detectHerbs(trimmed) : [];
    if (drugs.length >= 2) {
      setPendingBanner({ type: "drug", drugs, query: trimmed });
      return;
    }
    if (herbs.length > 0 && drugs.length >= 1) {
      setPendingBanner({
        type: "herb",
        herb: herbs[0],
        drug: drugs[0],
        query: trimmed,
      });
      return;
    }

    setQuery("");
    await coreSubmit(trimmed);
  };

  // Keyboard shortcut for clearing chat: Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMessages([]);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleModeChange = (newMode: string) => {
    if (newMode === "deep-research") {
      if (oracleLimited) {
        addToast("Med Deep Research requires PRO.", "info");
        return;
      }
      router.push("/deep-research");
      return;
    }
    if (newMode === "search" && webLocked) {
      router.push("/search");
      return;
    }
    if (newMode === "search" && oracleLimited) {
      addToast("Manthana Web search requires PRO.", "info");
      return;
    }
    if (newMode === "m5") {
      setMode("m5");
      updateURL("m5", activeDomain);
      setSearchResults(null);
      return;
    }
    setMode(newMode);
    setSearchResults(null); // clear search results when switching modes
    setSearchPage(1);
    updateURL(newMode, activeDomain);
  };

  const handleDomainChange = (newDomain: string) => {
    setActiveDomain(newDomain);
    setSearchResults(null); // clear search results when switching domain
    setSearchPage(1);
    // M5: selecting M5 domain also sets mode to m5
    if (newDomain === "m5") {
      setMode("m5");
      updateURL("m5", "m5");
    } else {
      // Switching away from M5 back to single domain
      const effectiveMode = activeDomain === "m5" ? "auto" : mode;
      if (activeDomain === "m5") setMode("auto");
      updateURL(effectiveMode, newDomain);
    }
  };

  const handleNewConversation = () => {
    abortRef.current?.abort();
    setMessages([]);
    setQuery("");
    setIsThinking(false);
    setSearchResults(null);
    setSearchPage(1);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Domain Pills only (Oracle domains) */}
      <div className="px-4 py-3">
        <DomainPills activeDomain={activeDomain} onSelect={handleDomainChange} />
      </div>

      {/* ── EMPTY STATE (hero) ── */}
      {!hasMessages && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          {/* Sacred Logo with subtle static glow */}
          <div
            className="relative"
            role="img"
            aria-label="Manthana — Where Ancient Wisdom Meets Modern Medicine"
          >
            {/* Single static glow — no animation, no repaint */}
            <div
              className="absolute inset-[-20%] rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(200,146,42,0.12) 0%, rgba(61,219,200,0.04) 40%, transparent 70%)",
              }}
            />
            <Logo size="hero" animate={true} />
          </div>

          {/* Wordmark */}
          <h1 className="text-shimmer font-ui text-3xl md:text-4xl font-semibold tracking-[0.25em] uppercase">
            MANTHANA
          </h1>

          {/* Diamond Separator */}
          <div className="diamond-sep">
            <span />
            <span />
            <span />
          </div>

          {/* Tagline */}
          <p className="font-body text-sm md:text-base italic text-cream/48 text-center max-w-md">
            Where Ancient Wisdom Meets Modern Medicine
          </p>

          {/* Sanskrit */}
          <p className="font-body text-xs text-gold-s/50 text-center">
            मंथन — ज्ञान से अमृत
          </p>

          {/* ═══ PHILOSOPHY SECTION ═══ */}
          <div className="w-full mt-16 animate-fi" style={{ animationDelay: "2.8s" }}>
            {/* Manifesto Stats */}
            <div className="w-full border-t border-b border-gold/[0.06] bg-black/40">
              <div className="grid grid-cols-3 max-w-3xl mx-auto">
                {[
                  { num: "5", label: "Medical Systems" },
                  { num: "∞", label: "Indexed Knowledge" },
                  { num: "1", label: "Unified Intelligence" },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col items-center gap-2 py-10">
                    <span className="text-shimmer font-ui text-3xl md:text-5xl font-light tracking-wide">
                      {stat.num}
                    </span>
                    <span className="font-ui text-[7px] md:text-[8px] tracking-[0.55em] uppercase text-cream/20">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Brand Story */}
            <div className="max-w-2xl mx-auto py-20 px-6 flex flex-col items-center gap-7 text-center">
              <div className="w-8 h-px bg-gold/30" />
              <h2 className="font-ui text-[9px] md:text-[11px] tracking-[0.7em] uppercase text-gold/30">
                The Philosophy
              </h2>
              <p className="font-body text-sm md:text-base leading-[1.88] text-cream/38 italic tracking-wide">
                In the beginning, the cosmic ocean held all wisdom — infinite, undivided, unseen.
                The <em className="text-cream/65 not-italic">Samudra Manthan</em> was not destruction,
                it was <em className="text-cream/65 not-italic">extraction</em>.
                From the same churning came poison and nectar alike.
                MANTHANA does what the gods did — it churns{" "}
                <em className="text-cream/65 not-italic">five oceans</em> of medicine simultaneously,
                so that what rises to the surface is only{" "}
                <em className="text-cream/65 not-italic">Amrita</em> — pure, verified, living knowledge.
              </p>
              <div className="w-8 h-px bg-gold/30" />
            </div>

            {/* Medical Systems Pills */}
            <div className="flex flex-wrap justify-center gap-2 pb-12">
              {["Ayurveda", "Allopathy", "Homeopathy", "Siddha", "Unani"].map((sys) => (
                <span
                  key={sys}
                  className="font-ui text-[7.5px] tracking-[0.38em] uppercase text-cream/22 py-1.5 px-4
                    border border-teal/20 rounded-sm
                    hover:text-teal-p hover:border-teal/50 hover:bg-teal/[0.04] hover:tracking-[0.43em]
                    transition-all duration-500 cursor-default"
                >
                  {sys}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCH RESULTS (Manthana Web mode) ── */}
      {mode === "search" && searchResults && (
        <ManthanWebResults
          data={searchResults}
          query={query || searchResults.query}
          domain={activeDomain}
          onRelatedClick={(q) => {
            setQuery(q);
            void handleSubmit(q);
          }}
          onPageChange={async (page) => {
            setSearchPage(page);
            const currentQ = query || searchResults?.query || "";
            if (!currentQ) return;
            setIsThinking(true);
            setSearchResults(null);
            try {
              const res = await searchMedical(currentQ, {
                category: activeDomain,
                page,
                lang: lang ?? "en",
              });
              setSearchResults(res);
            } finally {
              setIsThinking(false);
            }
          }}
        />
      )}

      {/* Loading spinner for search mode */}
      {mode === "search" && isThinking && !searchResults && (
        <div className="flex-1 flex items-center justify-center py-16">
          <ChurningState mode={mode} domain={activeDomain} />
        </div>
      )}

      {/* ── ACTIVE CHAT STATE ── */}
      {hasMessages && mode !== "search" && (
        <div
          className={`flex-1 overflow-y-auto pb-32 transition-all duration-700 ${
            mode === "deep-research"
              ? "ring-1 ring-purple-500/10 bg-purple-950/[0.03]"
              : ""
          }`}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          <div className="max-w-3xl mx-auto py-4 space-y-2">
            {isEmergencyResponse && (
              <div className="mx-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
                <strong>If this is a medical emergency, call 112 (India) or 911 (US) immediately.</strong> Do not delay.
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isThinking && !messages.some((m) => m.streaming) && <ChurningState mode={mode} domain={activeDomain} />}
            <div ref={scrollRef} />
          </div>
        </div>
      )}

      {/* ── INPUT BAR (sticky) ── */}
      <div className="sticky bottom-16 md:bottom-8 py-4 z-20">
        {pendingBanner && (
          <InlineTriggerBanner
            icon={pendingBanner.type === "drug" ? "💊" : "🌿"}
            message={
              pendingBanner.type === "drug"
                ? "Drug names detected — Run Interaction Check?"
                : "Herb and drug detected — Run Herb-Drug Safety Check?"
            }
            primaryLabel={
              pendingBanner.type === "drug"
                ? "Check Interactions"
                : "Check Safety"
            }
            secondaryLabel="Continue to Chat"
            onPrimary={() => {
              if (typeof window !== "undefined") {
                if (pendingBanner.type === "drug") {
                  (window as any).openClinicalTools?.("drug", {
                    drugs: pendingBanner.drugs,
                  });
                } else {
                  (window as any).openClinicalTools?.("herb", {
                    herb: pendingBanner.herb,
                    drug: pendingBanner.drug,
                  });
                }
              }
              setPendingBanner(null);
            }}
            onSecondary={async () => {
              const q = pendingBanner.query;
              setPendingBanner(null);
              setQuery("");
              await coreSubmit(q);
            }}
          />
        )}
        <div className="max-w-3xl mx-auto px-4 mb-2 flex items-center justify-between text-[10px] text-cream/30 font-ui tracking-[0.18em] uppercase">
          <span
            role="status"
            aria-live="polite"
            aria-label={`Current mode: ${modeLabel(
              mode
            )}, domain: ${domainLabel(activeDomain)}`}
          >
            {modeLabel(mode)} · {domainLabel(activeDomain)}
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">
              Answers are for research and education only.
            </span>
            <button
              type="button"
              onClick={handleNewConversation}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-emerald-400/60 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 hover:border-emerald-300 text-[10px] tracking-[0.16em] uppercase font-ui"
              aria-label="Start new Oracle conversation"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-400 text-[13px] font-semibold text-slate-950">
                +
              </span>
              <span className="hidden xs:inline">New</span>
            </button>
          </div>
        </div>
        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={handleSubmit}
          mode={mode}
          manthanaWebLocked={webLocked}
          domain={activeDomain}
          intensity={intensity}
          persona={persona}
          evidence={evidence}
          onIntensityChange={setIntensity}
          onPersonaChange={setPersona}
          onEvidenceChange={setEvidence}
          isThinking={isThinking}
          onStop={() => abortRef.current?.abort()}
          oracleLimited={oracleLimited}
        />
      </div>
    </div>
  );
}
