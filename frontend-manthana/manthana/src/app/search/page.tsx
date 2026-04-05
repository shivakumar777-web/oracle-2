"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ManthanaWebComingSoon from "@/components/ManthanaWebComingSoon";
import { isManthanaWebLocked } from "@/lib/manthana-web-locked";
import Logo from "@/components/Logo";
import {
  searchMedical,
  searchPapers,
  searchGuidelines,
  searchTrials,
  searchPdfs,
  searchArticles,
  searchImages,
  searchVideos,
  recordClick,
  type SearchResponse,
  type SearchResult,
  type ImageResult,
  type VideoResult,
  type TabCounts,
} from "@/lib/api/web";
import { useLang } from "@/components/LangProvider";
import { KnowledgePanel } from "@/components/search/KnowledgePanel";
import { TrendingSearches } from "@/components/search/TrendingSearches";
import { SearchHistory } from "@/components/search/SearchHistory";
import { useToast } from "@/hooks/useToast";
import { SearchPageSkeleton } from "@/components/Skeletons";
import ImageStrip from "@/components/search/ImageStrip";
import VideoStrip from "@/components/search/VideoStrip";
import { TrialCard } from "@/components/search/TrialCard";
import { PdfCard } from "@/components/search/PdfCard";
import { FeaturedResult } from "@/components/search/FeaturedResult";
import { SourceDiversityMeter } from "@/components/search/SourceDiversityMeter";
import { useSearchKeyboard } from "@/hooks/useSearchKeyboard";
import { getEvidenceLevel, getEvidenceBadge } from "@/lib/search-evidence";
import SearchSessionRail from "@/components/search/SearchSessionRail";
import SearchNewTabButton from "@/components/search/SearchNewTabButton";
import { toViewerHref } from "@/lib/viewer-url";

/** Extract a meaningful entity name from a search result title */
function extractEntityName(title: string): string {
  const cleaned = title
    .replace(/^(Interaction Profile|Systematic Review|Clinical Guidelines):\s*/i, "")
    .replace(/\s*—\s*.+$/, "")
    .replace(/\s*\(.+\)\s*$/, "")
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 4);
  return words.join(" ");
}

/** Per-tab state: data, page, pageToken (trials), loading, hasLoaded, loadedAt (SWR stale) */
interface TabState {
  data: SearchResponse | ImagesTabData | VideosTabData | null;
  page: number;
  pageToken?: string;
  isLoading: boolean;
  hasLoaded: boolean;
  loadedAt?: number;
}

/** SWR: consider data stale after this many ms */
const TAB_STALE_MS = 60_000;

interface ImagesTabData {
  images: ImageResult[];
  total: number;
  page: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

interface VideosTabData {
  videos: VideoResult[];
  total: number;
  page: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

/** Tab config: id, label, fetcher key for lazy load */
const FILTER_TABS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "papers", label: "Research Papers" },
  { id: "guidelines", label: "Clinical Guidelines" },
  { id: "trials", label: "Trials" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "pdfs", label: "PDFs" },
  { id: "articles", label: "Articles" },
];

/** Derive badge label and class from result type/source for display */
function getResultBadge(result: { type?: string; source?: string; domain?: string }): {
  badge: string;
  badgeClass: string;
} {
  const type = (result.type ?? "").toLowerCase();
  const source = (result.source ?? result.domain ?? "").toLowerCase();
  if (type === "guideline") return { badge: "CLINICAL", badgeClass: "badge-clinical" };
  if (type === "trial") return { badge: "TRIAL", badgeClass: "badge-research" };
  if (type === "pdf") return { badge: "PDF", badgeClass: "badge-research" };
  if (source.includes("ayurveda") || source.includes("ayush")) return { badge: "AYURVEDA", badgeClass: "badge-ayurveda" };
  if (source.includes("drugbank") || source.includes("drug")) return { badge: "DRUG DB", badgeClass: "badge-drug" };
  if (source.includes("who") || source.includes("guideline")) return { badge: "CLINICAL", badgeClass: "badge-clinical" };
  if (source.includes("pubmed") || source.includes("ncbi")) return { badge: "RESEARCH", badgeClass: "badge-research" };
  return { badge: result.source || "WEB", badgeClass: "badge-research" };
}

function isSearchResponse(d: TabState["data"]): d is SearchResponse {
  return d != null && "results" in d && Array.isArray((d as SearchResponse).results);
}

function isImagesTabData(d: TabState["data"]): d is ImagesTabData {
  return d != null && "images" in d && Array.isArray((d as ImagesTabData).images);
}

function isVideosTabData(d: TabState["data"]): d is VideosTabData {
  return d != null && "videos" in d && Array.isArray((d as VideosTabData).videos);
}

type SearchSessionViewProps = {
  initialQuery: string;
  onWorkspaceQueryChange: (q: string) => void;
};

function SearchSessionView({ initialQuery, onWorkspaceQueryChange }: SearchSessionViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => initialQuery);
  const [activeTab, setActiveTab] = useState(() => searchParams?.get("tab") ?? "all");
  const [tabStates, setTabStates] = useState<Record<string, TabState>>({});
  const { lang } = useLang();
  const { addToast } = useToast();
  const [isTyping, setIsTyping] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [isAutoScrollingTabs, setIsAutoScrollingTabs] = useState(true);
  const isDraggingTabsRef = useRef(false);
  const lastPointerXRef = useRef<number | null>(null);

  const currentDomain = searchParams?.get("domain") ?? "allopathy";

  /** Get tab counts from "all" tab data (tabCounts) or from loaded tab data */
  const getTabCount = useCallback((tabId: string): number => {
    const allData = tabStates["all"]?.data;
    if (isSearchResponse(allData) && allData.tabCounts) {
      const counts = allData.tabCounts as TabCounts;
      const k = tabId as keyof TabCounts;
      return counts[k] ?? 0;
    }
    const state = tabStates[tabId];
    if (!state?.data) return 0;
    const d = state.data;
    if (isImagesTabData(d)) return d.images.length;
    if (isVideosTabData(d)) return d.videos.length;
    if (isSearchResponse(d)) return (d as SearchResponse).results?.length ?? 0;
    return 0;
  }, [tabStates]);

  const setTabWithUrl = useCallback((tab: string) => {
    setActiveTab(tab);
    setSelectedResultIndex(-1);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (query) params.set("q", query);
    params.set("tab", tab);
    params.set("domain", currentDomain);
    params.delete("page");
    router.replace(`/search?${params.toString()}`, { scroll: false });
  }, [query, currentDomain, router, searchParams]);

  /** Fetch a specific tab's data. background=true: SWR refetch, don't show loading. */
  const fetchTab = useCallback(async (tabId: string, pageNum: number = 1, pageToken?: string, background?: boolean) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const isBackground = background && tabStates[tabId]?.hasLoaded;

    setTabStates((prev) => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        isLoading: !isBackground,
        hasLoaded: prev[tabId]?.hasLoaded ?? false,
        data: prev[tabId]?.data ?? null,
        page: pageNum,
        pageToken,
      },
    }));

    try {
      if (tabId === "all") {
        const res = await searchMedical(trimmed, {
          category: currentDomain,
          page: pageNum,
          lang: lang ?? "en",
        });
        setTabStates((prev) => ({
          ...prev,
          [tabId]: {
            data: res,
            page: pageNum,
            isLoading: false,
            hasLoaded: true,
            loadedAt: Date.now(),
          },
        }));
      } else if (tabId === "papers") {
        const res = await searchPapers(trimmed, { page: pageNum });
        setTabStates((prev) => ({
          ...prev,
          [tabId]: {
            data: res,
            page: pageNum,
            isLoading: false,
            hasLoaded: true,
            loadedAt: Date.now(),
          },
        }));
      } else if (tabId === "guidelines") {
        const res = await searchGuidelines(trimmed, { page: pageNum });
        setTabStates((prev) => ({
          ...prev,
          [tabId]: {
            data: res,
            page: pageNum,
            isLoading: false,
            hasLoaded: true,
            loadedAt: Date.now(),
          },
        }));
      } else if (tabId === "trials") {
        const res = await searchTrials(trimmed, {
          page: pageNum,
          pageToken: pageNum > 1 ? pageToken : undefined,
        });
        setTabStates((prev) => ({
          ...prev,
          [tabId]: {
            data: res,
            page: pageNum,
            pageToken: res.nextPageToken,
            isLoading: false,
            hasLoaded: true,
            loadedAt: Date.now(),
          },
        }));
      } else if (tabId === "images") {
        const res = await searchImages(trimmed, { page: pageNum });
        setTabStates((prev) => ({
          ...prev,
          [tabId]: {
            data: res,
            page: pageNum,
            isLoading: false,
            hasLoaded: true,
            loadedAt: Date.now(),
          },
        }));
      } else if (tabId === "videos") {
        const res = await searchVideos(trimmed, { page: pageNum });
        setTabStates((prev) => ({
          ...prev,
          [tabId]: {
            data: res,
            page: pageNum,
            isLoading: false,
            hasLoaded: true,
            loadedAt: Date.now(),
          },
        }));
      } else if (tabId === "pdfs") {
        const res = await searchPdfs(trimmed, { page: pageNum });
        setTabStates((prev) => ({
          ...prev,
          [tabId]: {
            data: res,
            page: pageNum,
            isLoading: false,
            hasLoaded: true,
            loadedAt: Date.now(),
          },
        }));
      } else if (tabId === "articles") {
        const res = await searchArticles(trimmed, {
          category: currentDomain,
          page: pageNum,
          lang: lang ?? "en",
        });
        setTabStates((prev) => ({
          ...prev,
          [tabId]: {
            data: res,
            page: pageNum,
            isLoading: false,
            hasLoaded: true,
            loadedAt: Date.now(),
          },
        }));
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Search failed — please try again.", "error");
      setTabStates((prev) => ({
        ...prev,
        [tabId]: {
          ...prev[tabId],
          isLoading: false,
          hasLoaded: prev[tabId]?.hasLoaded ?? false,
        },
      }));
    }
  }, [query, currentDomain, lang, addToast, tabStates]);

  /** Initial search: fetch "all" tab */
  const runSearch = useCallback(async (pageNum: number = 1) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsTyping(false);
    setIsSearching(true);
    setHasSearched(true);
    setTabStates((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (id !== "all") delete next[id];
      }
      return next;
    });
    await fetchTab("all", pageNum);
    setIsSearching(false);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (query.trim()) params.set("q", query.trim());
    params.set("tab", activeTab);
    params.set("domain", currentDomain);
    if (pageNum > 1) params.set("page", String(pageNum));
    else params.delete("page");
    router.replace(`/search?${params.toString()}`, { scroll: false });
  }, [query, activeTab, currentDomain, fetchTab, router, searchParams]);

  /** When user switches to a tab: fetch if not loaded, or refetch if stale (SWR) */
  useEffect(() => {
    if (!hasSearched || !query.trim()) return;
    const state = tabStates[activeTab];
    if (!state?.hasLoaded && !state?.isLoading) {
      void fetchTab(activeTab, 1);
      return;
    }
    if (state?.hasLoaded && state?.data && !state?.isLoading) {
      const loadedAt = state.loadedAt ?? 0;
      if (Date.now() - loadedAt > TAB_STALE_MS) {
        void fetchTab(activeTab, state.page, state.pageToken, true);
      }
    }
  }, [activeTab, hasSearched, query, tabStates, fetchTab]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    onWorkspaceQueryChange(val);
    setIsSearching(false);
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 600);
  };

  /** Keep workspace tab label in sync when query is set from Trending / History / Knowledge */
  const setQueryAndWorkspace = useCallback(
    (q: string) => {
      setQuery(q);
      onWorkspaceQueryChange(q);
    },
    [onWorkspaceQueryChange]
  );

  const triggerSearchAnimation = () => {
    void runSearch(1);
  };

  const handleResultClick = (result: SearchResult, idx: number) => {
    if (result.url) {
      recordClick(query.trim(), result.url, idx + 1);
    }
  };

  const handleTabClick = (tabId: string) => {
    stopTabAutoScroll();
    setTabWithUrl(tabId);
  };

  /** Paginate current tab */
  const loadPage = (direction: "prev" | "next") => {
    const state = tabStates[activeTab];
    if (!state?.data) return;
    const page = state.page;
    const nextPage = direction === "next" ? page + 1 : page - 1;
    if (nextPage < 1) return;
    const pageToken = direction === "next" ? state.pageToken : undefined;
    void fetchTab(activeTab, nextPage, pageToken);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (query) params.set("q", query);
    params.set("tab", activeTab);
    params.set("page", String(nextPage));
    router.replace(`/search?${params.toString()}`, { scroll: false });
  };

  const stopTabAutoScroll = () => {
    if (isAutoScrollingTabs) setIsAutoScrollingTabs(false);
  };

  const DRAG_THRESHOLD_PX = 5;
  const hasCapturedRef = useRef(false);

  const handleTabsPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    stopTabAutoScroll();
    if (event.button !== 0) return;
    isDraggingTabsRef.current = true;
    hasCapturedRef.current = false;
    lastPointerXRef.current = event.clientX;
  };

  const handleTabsPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingTabsRef.current) return;
    const container = tabsContainerRef.current;
    if (!container || lastPointerXRef.current == null) return;
    const deltaX = event.clientX - lastPointerXRef.current;
    if (!hasCapturedRef.current) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
      hasCapturedRef.current = true;
      container.setPointerCapture(event.pointerId);
      container.style.cursor = "grabbing";
    }
    container.scrollLeft -= deltaX;
    lastPointerXRef.current = event.clientX;
  };

  const endTabsDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingTabsRef.current) return;
    const container = tabsContainerRef.current;
    const hadCapture = hasCapturedRef.current;
    isDraggingTabsRef.current = false;
    hasCapturedRef.current = false;
    lastPointerXRef.current = null;
    if (container && hadCapture) {
      try {
        container.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      container.style.cursor = "";
    }
  };

  useEffect(() => {
    if (!isAutoScrollingTabs) return;
    const el = tabsContainerRef.current;
    if (!el) return;
    let frameId: number;
    const scrollSpeed = 0.4;
    const step = () => {
      const container = tabsContainerRef.current;
      if (!container) return;
      if (container.scrollWidth <= container.clientWidth) return;
      const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;
      if (atEnd) {
        container.scrollLeft = 0;
      } else {
        container.scrollLeft += scrollSpeed;
      }
      frameId = window.requestAnimationFrame(step);
    };
    frameId = window.requestAnimationFrame(step);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [isAutoScrollingTabs]);

  const allState = tabStates["all"];
  const activeState = tabStates[activeTab];
  const isActiveLoading = activeState?.isLoading ?? false;
  const showAllSkeleton = isSearching && activeTab === "all";

  /** Render a single result (article, trial, or pdf card) */
  const renderResult = (result: SearchResult, idx: number) => {
    const type = (result.type ?? "article").toLowerCase();
    if (type === "trial") {
      return (
        <TrialCard
          key={result.url ?? idx}
          result={result}
          currentDomain={currentDomain}
          onRecordClick={handleResultClick}
          idx={idx}
        />
      );
    }
    if (type === "pdf") {
      return (
        <PdfCard
          key={result.url ?? idx}
          result={result}
          currentDomain={currentDomain}
          onRecordClick={handleResultClick}
          idx={idx}
        />
      );
    }
    const { badge, badgeClass } = getResultBadge(result);
    const url = result.url;
    const viewerHref = url ? toViewerHref(url) : null;
    const evidenceBadge = getEvidenceBadge(getEvidenceLevel(result));
    const isSelected = selectedResultIndex === idx;
    return (
      <article
        key={url ?? idx}
        role="article"
        className={`glass rounded-xl p-5 hover:bg-white/[0.06] hover:scale-[1.005] transition-all duration-200 group ${
          isSelected ? "ring-2 ring-gold/50 ring-offset-2 ring-offset-[#020618]" : ""
        }`}
        aria-labelledby={`result-title-${idx}`}
        data-result-index={idx}
      >
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`pill text-[9px] px-2 py-0.5 ${badgeClass}`}>{badge}</span>
          {evidenceBadge && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${evidenceBadge.className}`}>
              {evidenceBadge.label}
            </span>
          )}
          <span className="font-ui text-[10px] text-cream/25 uppercase tracking-wider">
            {result.domain ?? result.source ?? ""}
          </span>
        </div>
        <h3 id={`result-title-${idx}`} className="font-ui text-sm font-medium text-cream/80 group-hover:text-gold-h transition-colors mb-2 leading-snug">
          {url ? (
            viewerHref ? (
              <Link
                href={viewerHref}
                onClick={() => handleResultClick(result, idx)}
                className="hover:text-gold-h"
              >
                {(result.title ?? "") as string}
              </Link>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleResultClick(result, idx)}
                className="hover:text-gold-h"
              >
                {(result.title ?? "") as string}
              </a>
            )
          ) : (
            (result.title ?? "") as string
          )}
        </h3>
        <p className="font-body text-xs text-cream/35 leading-relaxed line-clamp-2">
          {result.snippet ?? ""}
        </p>
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <span className="font-ui text-[10px] text-cream/20">
            {(result.publishedDate ?? result.date ?? "") as string}
          </span>
          {(result.trustScore ?? 0) > 0 && (
            <>
              <div className="flex-1 min-w-[60px] max-w-[100px] h-1 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-s to-gold-h rounded-full transition-all"
                  style={{ width: `${result.trustScore}%` }}
                />
              </div>
              <span className="font-ui text-[10px] text-gold/60">
                {(result.trustScore ?? 0)}% trust
              </span>
            </>
          )}
          <Link
            href={`/?q=${encodeURIComponent(`Explain: ${result.title} — focus on key findings and clinical implications.`)}&domain=${currentDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-ui text-[10px] text-teal-h underline underline-offset-2 decoration-teal/60 hover:text-teal-p"
          >
            Ask Oracle in new tab →
          </Link>
        </div>
      </article>
    );
  };

  /** All tab: results with FeaturedResult (when trust>=80), ImageStrip after ~3, VideoStrip after ~6 */
  const renderAllTabResults = () => {
    const data = allState?.data;
    if (!isSearchResponse(data)) return null;
    const results = data.results ?? [];
    const images = data.images ?? [];
    const videos = data.videos ?? [];
    const firstResult = results[0];
    const showFeatured = firstResult && (firstResult.trustScore ?? 0) >= 80;
    const out: React.ReactNode[] = [];

    if (showFeatured && firstResult) {
      out.push(
        <FeaturedResult
          key="featured"
          result={firstResult}
          currentDomain={currentDomain}
          onRecordClick={handleResultClick}
          isSelected={selectedResultIndex === 0}
        />
      );
    }

    results.forEach((r, idx) => {
      if (showFeatured && idx === 0) return;
      if (idx === 3 && images.length > 0) {
        out.push(
          <ImageStrip
            key="img-strip"
            images={images}
            onViewAll={() => handleTabClick("images")}
          />
        );
      }
      if (idx === 6 && videos.length > 0) {
        out.push(
          <VideoStrip
            key="vid-strip"
            videos={videos}
            onViewAll={() => handleTabClick("videos")}
          />
        );
      }
      out.push(renderResult(r, idx));
    });
    if (results.length >= 3 && images.length > 0 && !out.some((n) => (n as React.ReactElement)?.key === "img-strip")) {
      out.push(
        <ImageStrip
          key="img-strip"
          images={images}
          onViewAll={() => handleTabClick("images")}
        />
      );
    }
    if (results.length >= 6 && videos.length > 0 && !out.some((n) => (n as React.ReactElement)?.key === "vid-strip")) {
      out.push(
        <VideoStrip
          key="vid-strip"
          videos={videos}
          onViewAll={() => handleTabClick("videos")}
        />
      );
    }
    return out;
  };

  /** Get pagination info for current tab */
  const getPaginationInfo = (): { page: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } | null => {
    const state = tabStates[activeTab];
    if (!state?.data) return null;
    const data = state.data;
    if (isImagesTabData(data)) {
      return {
        page: data.page,
        totalPages: data.totalPages ?? 1,
        hasNextPage: data.hasNextPage ?? false,
        hasPrevPage: data.hasPrevPage ?? false,
      };
    }
    if (isVideosTabData(data)) {
      return {
        page: data.page,
        totalPages: data.totalPages ?? 1,
        hasNextPage: data.hasNextPage ?? false,
        hasPrevPage: data.hasPrevPage ?? false,
      };
    }
    const sr = data as SearchResponse;
    return {
      page: sr.page ?? state.page,
      totalPages: sr.totalPages ?? 1,
      hasNextPage: sr.hasNextPage ?? Boolean(sr.nextPageToken),
      hasPrevPage: sr.hasPrevPage ?? state.page > 1,
    };
  };

  const pagination = getPaginationInfo();

  /** Current navigable results for keyboard (all, papers, guidelines, trials, pdfs, articles) */
  const navigableResults = (() => {
    const state = tabStates[activeTab];
    if (!state?.data || isImagesTabData(state.data) || isVideosTabData(state.data)) return [];
    const sr = state.data as SearchResponse;
    return sr.results ?? [];
  })();

  const openResultAtIndex = useCallback(
    (idx: number) => {
      const r = navigableResults[idx];
      if (!r?.url) return;
      const vh = toViewerHref(r.url);
      if (vh) router.push(vh);
      else window.open(r.url, "_blank");
    },
    [navigableResults, router]
  );

  const copyCitationAtIndex = useCallback(async (idx: number) => {
    const r = navigableResults[idx];
    if (!r) return;
    const { copyCitation } = await import("@/lib/citation-generator");
    await copyCitation(r);
    addToast("Citation copied to clipboard", "success");
  }, [navigableResults, addToast]);

  useSearchKeyboard({
    searchInputRef,
    resultCount: navigableResults.length,
    selectedIndex: selectedResultIndex,
    onSelectIndex: setSelectedResultIndex,
    onOpenResult: openResultAtIndex,
    onCopyCitation: copyCitationAtIndex,
    onFocusSearch: () => searchInputRef.current?.focus(),
    enabled: hasSearched && navigableResults.length > 0,
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Search Topbar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Logo size="nav" animate={false} />
          <SearchNewTabButton />
          <span className="text-shimmer font-ui text-xs tracking-[0.15em] uppercase hidden sm:block">
            MANTHANA WEB
          </span>
        </div>

        <div className="flex-1 max-w-2xl relative">
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                triggerSearchAnimation();
              }
            }}
            className="w-full bg-[#0D1B3E] border border-gold/20 rounded-[28px] px-5 py-2.5
              font-body text-sm text-cream outline-none
              focus:border-gold/50 focus:shadow-[0_0_16px_rgba(200,146,42,0.12)] transition-all pr-14"
            role="searchbox"
            aria-label="Search medical knowledge"
            aria-describedby="search-help"
          />
          <button
            type="button"
            onClick={triggerSearchAnimation}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-gold/50 bg-black/60 flex items-center justify-center shadow-[0_0_14px_rgba(200,146,42,0.45)]"
            aria-label="Run Manthana web search"
          >
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-[#020618]"
              style={{
                animation: query.trim()
                  ? `manthanaSpin ${isTyping ? "1.2s" : isSearching ? "2.8s" : "7s"} linear infinite`
                  : "none",
              }}
            >
              <div className="scale-[1.1]">
                <Logo size="nav" animate={false} />
              </div>
            </div>
          </button>
        </div>
        <p id="search-help" className="sr-only">
          Enter a medical term, drug name, condition, or symptom to search
        </p>
      </div>

      {/* Filter Tabs */}
      <div
        ref={tabsContainerRef}
        role="tablist"
        aria-label="Result type filters"
        className="flex items-center gap-1 px-4 py-2 overflow-x-auto no-scrollbar border-b border-white/[0.04] cursor-grab"
        onWheel={stopTabAutoScroll}
        onPointerDown={handleTabsPointerDown}
        onPointerMove={handleTabsPointerMove}
        onPointerUp={endTabsDrag}
        onPointerLeave={endTabsDrag}
        onTouchStart={stopTabAutoScroll}
      >
        {FILTER_TABS.map((tab) => {
          const count = getTabCount(tab.id);
          return (
            <button
              key={tab.id}
              role="tab"
              onClick={() => handleTabClick(tab.id)}
              className={`pill text-[10px] flex-shrink-0 transition-all ${
                activeTab === tab.id
                  ? "text-gold-h border-b-2 border-gold rounded-none bg-transparent px-3 pb-2"
                  : "text-cream/30 hover:text-cream/50"
              }`}
              aria-pressed={activeTab === tab.id}
              aria-label={`${tab.label}${count > 0 ? ` (${count} results)` : ""}`}
            >
              {tab.label}
              {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Results Body */}
      <div className="flex-1 flex flex-col md:flex-row gap-6 p-4 max-w-7xl mx-auto w-full">
        <div className="flex-1 space-y-3 stagger-rise">
          {showAllSkeleton ? (
            <SearchPageSkeleton />
          ) : isActiveLoading && !activeState?.hasLoaded ? (
            <SearchPageSkeleton />
          ) : activeTab === "images" && activeState?.data && isImagesTabData(activeState.data) ? (
            <>
              <p className="font-ui text-[10px] text-cream/25">
                {activeState.data.images.length} images
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {activeState.data.images.map((img: ImageResult, idx: number) => {
                  const pageUrl = img.sourceUrl || img.url;
                  const vh = toViewerHref(pageUrl);
                  const cls =
                    "block rounded-xl overflow-hidden glass hover:scale-[1.02] transition-transform";
                  const inner = (
                    <>
                      <img
                        src={img.thumbnail || img.url}
                        alt={img.title || "Medical image"}
                        className="w-full aspect-square object-cover"
                      />
                      <p className="p-2 font-body text-[10px] text-cream/70 line-clamp-2">
                        {img.title}
                      </p>
                    </>
                  );
                  return vh ? (
                    <Link
                      key={img.url ?? idx}
                      href={vh}
                      className={cls}
                      onClick={() => recordClick(query.trim(), pageUrl, idx + 1)}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <a
                      key={img.url ?? idx}
                      href={pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cls}
                      onClick={() => recordClick(query.trim(), pageUrl, idx + 1)}
                    >
                      {inner}
                    </a>
                  );
                })}
              </div>
            </>
          ) : activeTab === "videos" && activeState?.data && isVideosTabData(activeState.data) ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeState!.data.videos.map((vid: VideoResult, idx: number) => {
                  const vh = toViewerHref(vid.url);
                  const cls = "block rounded-xl overflow-hidden glass hover:scale-[1.01] transition-transform";
                  const inner = (
                    <>
                      <img
                        src={vid.thumbnail}
                        alt={vid.title || "Medical video"}
                        className="w-full aspect-video object-cover"
                      />
                      <div className="p-3">
                        <p className="font-body text-xs text-cream/80 line-clamp-2">{vid.title}</p>
                        <p className="font-ui text-[10px] text-cream/40 mt-1">{vid.source}</p>
                      </div>
                    </>
                  );
                  return vh ? (
                    <Link
                      key={vid.url ?? idx}
                      href={vh}
                      className={cls}
                      onClick={() => recordClick(query.trim(), vid.url, idx + 1)}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <a
                      key={vid.url ?? idx}
                      href={vid.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cls}
                      onClick={() => recordClick(query.trim(), vid.url, idx + 1)}
                    >
                      {inner}
                    </a>
                  );
                })}
              </div>
            </>
          ) : activeTab === "all" && allState?.data && isSearchResponse(allState.data) ? (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                <p className="font-ui text-[10px] text-cream/25">
                  About {allState.data.total} results
                </p>
                <SourceDiversityMeter
                  enginesUsed={allState.data.enginesUsed ?? []}
                  elapsed={allState.data.elapsed}
                />
              </div>
              {renderAllTabResults()}
            </>
          ) : (activeTab === "papers" || activeTab === "guidelines" || activeTab === "trials" || activeTab === "pdfs" || activeTab === "articles") &&
            activeState?.data &&
            isSearchResponse(activeState.data) ? (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                <p className="font-ui text-[10px] text-cream/25">
                  About {(activeState.data as SearchResponse).total} results
                </p>
                <SourceDiversityMeter
                  enginesUsed={(activeState.data as SearchResponse).enginesUsed ?? []}
                  elapsed={(activeState.data as SearchResponse).elapsed}
                />
              </div>
              {(activeState!.data as SearchResponse).results.map((r, idx) => renderResult(r, idx))}
            </>
          ) : hasSearched ? (
            <div className="glass rounded-xl p-8 text-center">
              <p className="font-ui text-sm text-cream/40">
                No results for this filter. Try &quot;All&quot; or a different query.
              </p>
            </div>
          ) : (
            <div className="glass rounded-xl p-8 text-center">
              <p className="font-ui text-sm text-cream/40">Type a query and press Enter to search.</p>
            </div>
          )}

          {/* Pagination */}
          {pagination && (pagination.totalPages > 1 || pagination.hasNextPage) && (
            <nav
              className="flex items-center justify-center gap-4 py-6"
              aria-label="Search results pagination"
            >
              <button
                type="button"
                disabled={!pagination.hasPrevPage}
                onClick={() => loadPage("prev")}
                className="px-4 py-2 rounded-lg border border-gold/30 text-cream/70 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold/10"
                aria-label="Previous page"
              >
                ← Previous
              </button>
              <span className="font-ui text-sm text-cream/50" aria-current="page">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={!pagination.hasNextPage}
                onClick={() => loadPage("next")}
                className="px-4 py-2 rounded-lg border border-gold/30 text-cream/70 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold/10"
                aria-label="Next page"
              >
                Next →
              </button>
            </nav>
          )}
        </div>

        <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6">
          {!hasSearched && (
            <>
              <TrendingSearches
                onSelect={(q) => {
                  setQueryAndWorkspace(q);
                  void runSearch(1);
                }}
              />
              <SearchHistory
                onSelect={(q) => {
                  setQueryAndWorkspace(q);
                  void runSearch(1);
                }}
              />
            </>
          )}
          <KnowledgePanel
            entityName={
              (() => {
                const d = allState?.data;
                if (!d || !isSearchResponse(d)) return query.split(" ").slice(0, 3).join(" ");
                const first = d.results?.[0]?.title;
                return first ? extractEntityName(first as string) : query.split(" ").slice(0, 3).join(" ");
              })()
            }
            domain={currentDomain}
            query={query.trim() || undefined}
            relatedQuestions={
              (() => {
                const d = allState?.data;
                return d && isSearchResponse(d) ? (d.relatedQuestions ?? []) : [];
              })()
            }
            onRelatedClick={(q) => {
              setQueryAndWorkspace(q);
              void runSearch(1);
            }}
            guidelines={
              (() => {
                const d = allState?.data;
                return d && isSearchResponse(d)
                  ? (d.results
                      ?.filter((r) => (r.type ?? "") === "guideline")
                      .slice(0, 5)
                      .map((r) => ({ title: r.title, url: r.url, source: r.source })) ?? [])
                  : [];
              })()
            }
            trials={
              (() => {
                const d = allState?.data;
                return d && isSearchResponse(d)
                  ? (d.results
                      ?.filter((r) => (r.type ?? "") === "trial")
                      .slice(0, 5)
                      .map((r) => ({ title: r.title, url: r.url, snippet: r.snippet })) ?? [])
                  : [];
              })()
            }
          />
        </aside>
      </div>
      <style jsx>{`
        @keyframes manthanaSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

/** Workspace: multiple in-app sessions (swipe chip to close on mobile) + browser new tab (+). */
export default function SearchPage() {
  const searchParams = useSearchParams();

  if (isManthanaWebLocked()) {
    return (
      <div className="min-h-[calc(100dvh-10rem)] flex flex-col">
        <ManthanaWebComingSoon variant="full" />
      </div>
    );
  }

  const initialQ = searchParams?.get("q") ?? "";
  const [tabs, setTabs] = useState<{ id: string; q: string }[]>(() => [{ id: "ws-1", q: initialQ }]);
  const [active, setActive] = useState("ws-1");

  const activeData = tabs.find((t) => t.id === active) ?? tabs[0]!;

  return (
    <>
      <SearchSessionRail
        sessions={tabs.map((t) => ({
          id: t.id,
          label: t.q.trim()
            ? t.q.length > 28
              ? `${t.q.slice(0, 28)}…`
              : t.q
            : "New search",
        }))}
        activeId={active}
        onSelect={setActive}
        onClose={(id) => {
          setTabs((prev) => {
            if (prev.length <= 1) return prev;
            const next = prev.filter((t) => t.id !== id);
            setActive((cur) => (cur === id ? next[0]!.id : cur));
            return next;
          });
        }}
        onAddSession={() => {
          const id =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `ws-${Date.now()}`;
          setTabs((prev) => [...prev, { id, q: "" }]);
          setActive(id);
        }}
        onOpenBrowserTab={() => {
          if (typeof window === "undefined") return;
          window.open(`${window.location.origin}/search`, "_blank", "noopener,noreferrer");
        }}
      />
      <SearchSessionView
        key={active}
        initialQuery={activeData.q}
        onWorkspaceQueryChange={(q) => {
          setTabs((prev) => prev.map((t) => (t.id === active ? { ...t, q } : t)));
        }}
      />
    </>
  );
}
