/**
 * Web section API client.
 * Medical search, autocomplete, search-with-sources.
 */

import { fetchWithAuth } from "../core/client";
import { ApiError } from "../core/errors";
import { WEB_BASE } from "../config";
import type {
  SearchResult,
  ImageResult,
  VideoResult,
  SearchResponse,
  SearchSourcesResponse,
} from "./types";

export type {
  SearchResult,
  ImageResult,
  VideoResult,
  SearchResponse,
  SearchSourcesResponse,
  TabCounts,
} from "./types";

function mapResult(r: Record<string, unknown>): SearchResult {
  const base: SearchResult = {
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    snippet: String(r.snippet ?? r.content ?? ""),
    source: String(r.source ?? r.engine ?? "Web"),
    domain: String(r.domain ?? ""),
    engine: String(r.engine ?? "Web"),
    publishedDate: (r.publishedDate as string) ?? null,
    trustScore: Number(r.trustScore ?? 45),
    isPeerReviewed: Boolean(r.isPeerReviewed),
    isOfficial: Boolean(r.isOfficial),
    isOpenAccess: Boolean(r.isOpenAccess),
    thumbnail: (r.thumbnail as string) ?? null,
    type: (r.type as SearchResult["type"]) ?? "article",
  };
  if (r.paperFallback === true) base.paperFallback = true;
  if (r.guidelineFallback === true) base.guidelineFallback = true;
  if (r.trialsFallback === true) base.trialsFallback = true;
  if (r.sourceBadge != null && String(r.sourceBadge).trim())
    base.sourceBadge = String(r.sourceBadge);
  return base;
}

function mapImage(r: Record<string, unknown>): ImageResult {
  return {
    url: String(r.url ?? r.img_src ?? ""),
    title: String(r.title ?? ""),
    source: String(r.source ?? ""),
    sourceUrl: String(r.sourceUrl ?? r.url ?? ""),
    thumbnail: String(r.thumbnail ?? r.img_src ?? r.url ?? ""),
  };
}

function mapVideo(r: Record<string, unknown>): VideoResult {
  return {
    url: String(r.url ?? ""),
    title: String(r.title ?? ""),
    thumbnail: String(r.thumbnail ?? ""),
    source: String(r.source ?? ""),
    publishedDate: String(r.publishedDate ?? ""),
  };
}

/**
 * GET /search — medical search pipeline.
 */
export async function searchMedical(
  query: string,
  options?: { category?: string; page?: number; lang?: string }
): Promise<SearchResponse> {
  try {
    const params = new URLSearchParams({
      q: query,
      category: options?.category ?? "allopathy",
      page: String(options?.page ?? 1),
    });
    if (options?.lang) params.set("lang", options.lang);

    const res = await fetchWithAuth(`${WEB_BASE}/search?${params.toString()}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);

    const data = await res.json();
    const rawData = data.data ?? data;

    return {
      query: String(rawData.query ?? query),
      category: String(rawData.category ?? options?.category ?? "allopathy"),
      total: Number(rawData.total ?? rawData.results?.length ?? 0),
      page: Number(rawData.page ?? options?.page ?? 1),
      results: Array.isArray(rawData.results)
        ? rawData.results.map((r: Record<string, unknown>) => mapResult(r))
        : [],
      images: Array.isArray(rawData.images)
        ? rawData.images.map((r: Record<string, unknown>) => mapImage(r))
        : [],
      videos: Array.isArray(rawData.videos)
        ? rawData.videos.map((r: Record<string, unknown>) => mapVideo(r))
        : [],
      relatedQuestions: Array.isArray(rawData.relatedQuestions)
        ? rawData.relatedQuestions.map(String)
        : [],
      enginesUsed: Array.isArray(rawData.enginesUsed)
        ? rawData.enginesUsed.map(String)
        : [],
      localResults: Array.isArray(rawData.localResults)
        ? rawData.localResults.map((r: Record<string, unknown>) => mapResult(r))
        : [],
      elapsed: Number(rawData.elapsed ?? 0),
      synthesis: null,
      totalPages: rawData.totalPages,
      hasNextPage: rawData.hasNextPage,
      hasPrevPage: rawData.hasPrevPage,
      tabCounts: rawData.tabCounts,
    };
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? err.message : "Search service unavailable.",
      0,
      "search"
    );
  }
}

/**
 * GET /search — fetch search results for chat context.
 * Pure search only — web-service returns no AI synthesis.
 */
export async function fetchSearchWithSources(
  query: string,
  category: string,
  lang: string
): Promise<SearchSourcesResponse> {
  const params = new URLSearchParams({
    q: query,
    category,
    domain: category,
    lang: lang || "en",
  });
  const res = await fetchWithAuth(`${WEB_BASE}/search?${params.toString()}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return (data?.data ?? data) as SearchSourcesResponse;
}

/**
 * GET /trending — trending medical search queries.
 */
export async function getTrending(
  timeframe: "hour" | "day" | "week" = "day"
): Promise<{ query: string; count: number }[]> {
  const res = await fetchWithAuth(`${WEB_BASE}/trending?timeframe=${timeframe}`);
  if (!res.ok) return [];
  const data = await res.json();
  const raw = data?.data ?? data;
  return Array.isArray(raw?.queries) ? raw.queries : [];
}

/**
 * POST /feedback — record result click for analytics.
 */
export async function recordClick(
  query: string,
  resultUrl: string,
  position: number
): Promise<void> {
  try {
    await fetchWithAuth(`${WEB_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        result_url: resultUrl,
        position,
      }),
    });
  } catch {
    // Silently ignore analytics errors
  }
}

/**
 * GET /search/images — image search.
 */
export async function searchImages(
  query: string,
  options?: { page?: number }
): Promise<{ query: string; images: ImageResult[]; total: number; page: number; totalPages?: number; hasNextPage?: boolean; hasPrevPage?: boolean }> {
  const params = new URLSearchParams({
    q: query,
    page: String(options?.page ?? 1),
  });
  const res = await fetchWithAuth(`${WEB_BASE}/search/images?${params.toString()}`);
  if (!res.ok) return { query, images: [], total: 0, page: options?.page ?? 1 };
  const data = await res.json();
  const raw = data?.data ?? data;
  return {
    query: String(raw.query ?? query),
    images: Array.isArray(raw.images)
      ? raw.images.map((r: Record<string, unknown>) => mapImage(r))
      : [],
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    totalPages: raw.totalPages,
    hasNextPage: raw.hasNextPage,
    hasPrevPage: raw.hasPrevPage,
  };
}

/**
 * GET /search/videos — video search.
 */
export async function searchVideos(
  query: string,
  options?: { page?: number }
): Promise<{ query: string; videos: VideoResult[]; total: number; page: number; totalPages?: number; hasNextPage?: boolean; hasPrevPage?: boolean }> {
  const params = new URLSearchParams({
    q: query,
    page: String(options?.page ?? 1),
  });
  const res = await fetchWithAuth(`${WEB_BASE}/search/videos?${params.toString()}`);
  if (!res.ok) return { query, videos: [], total: 0, page: options?.page ?? 1 };
  const data = await res.json();
  const raw = data?.data ?? data;
  return {
    query: String(raw.query ?? query),
    videos: Array.isArray(raw.videos)
      ? raw.videos.map((r: Record<string, unknown>) => mapVideo(r))
      : [],
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    totalPages: raw.totalPages,
    hasNextPage: raw.hasNextPage,
    hasPrevPage: raw.hasPrevPage,
  };
}

/** Normalize API response to SearchResponse shape */
function normalizeSearchResponse(raw: Record<string, unknown>, query: string): SearchResponse {
  return {
    query: String(raw.query ?? query),
    category: String(raw.category ?? "medical"),
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    results: Array.isArray(raw.results)
      ? raw.results.map((r: Record<string, unknown>) => mapResult(r))
      : [],
    images: Array.isArray(raw.images)
      ? raw.images.map((r: Record<string, unknown>) => mapImage(r))
      : [],
    videos: Array.isArray(raw.videos)
      ? raw.videos.map((r: Record<string, unknown>) => mapVideo(r))
      : [],
    relatedQuestions: Array.isArray(raw.relatedQuestions)
      ? raw.relatedQuestions.map(String)
      : [],
    enginesUsed: Array.isArray(raw.enginesUsed)
      ? raw.enginesUsed.map(String)
      : [],
    localResults: [],
    elapsed: Number(raw.elapsed ?? 0),
    synthesis: null,
    totalPages: raw.totalPages as number | undefined,
    hasNextPage: raw.hasNextPage as boolean | undefined,
    hasPrevPage: raw.hasPrevPage as boolean | undefined,
    nextPageToken: raw.nextPageToken as string | undefined,
    paperFallback: raw.paperFallback === true ? true : undefined,
    guidelineFallback: raw.guidelineFallback === true ? true : undefined,
    trialsFallback: raw.trialsFallback === true ? true : undefined,
  };
}

/**
 * GET /search/papers — research papers (PubMed, Semantic Scholar).
 */
export async function searchPapers(
  query: string,
  options?: { page?: number; sort?: string }
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(options?.page ?? 1),
  });
  if (options?.sort) params.set("sort", options.sort);
  const res = await fetchWithAuth(`${WEB_BASE}/search/papers?${params.toString()}`);
  if (!res.ok) throw new ApiError("Papers search failed", res.status, "search");
  const data = await res.json();
  return normalizeSearchResponse(data?.data ?? data, query);
}

/**
 * GET /search/guidelines — clinical guidelines.
 */
export async function searchGuidelines(
  query: string,
  options?: { page?: number; org?: string }
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(options?.page ?? 1),
  });
  if (options?.org) params.set("org", options.org);
  const res = await fetchWithAuth(`${WEB_BASE}/search/guidelines?${params.toString()}`);
  if (!res.ok) throw new ApiError("Guidelines search failed", res.status, "search");
  const data = await res.json();
  return normalizeSearchResponse(data?.data ?? data, query);
}

/**
 * GET /search/trials — clinical trials.
 */
export async function searchTrials(
  query: string,
  options?: { page?: number; pageToken?: string; status?: string; phase?: string }
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(options?.page ?? 1),
  });
  if (options?.pageToken) params.set("page_token", options.pageToken);
  if (options?.status) params.set("status", options.status);
  if (options?.phase) params.set("phase", options.phase);
  const res = await fetchWithAuth(`${WEB_BASE}/search/trials?${params.toString()}`);
  if (!res.ok) throw new ApiError("Trials search failed", res.status, "search");
  const data = await res.json();
  return normalizeSearchResponse(data?.data ?? data, query);
}

/**
 * GET /search/pdfs — PDF documents.
 */
export async function searchPdfs(
  query: string,
  options?: { page?: number }
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(options?.page ?? 1),
  });
  const res = await fetchWithAuth(`${WEB_BASE}/search/pdfs?${params.toString()}`);
  if (!res.ok) throw new ApiError("PDFs search failed", res.status, "search");
  const data = await res.json();
  return normalizeSearchResponse(data?.data ?? data, query);
}

/**
 * GET /search?result_type=article — articles only.
 */
export async function searchArticles(
  query: string,
  options?: { category?: string; page?: number; lang?: string }
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    category: options?.category ?? "allopathy",
    page: String(options?.page ?? 1),
    result_type: "article",
  });
  if (options?.lang) params.set("lang", options.lang);
  const res = await fetchWithAuth(`${WEB_BASE}/search?${params.toString()}`);
  if (!res.ok) throw new ApiError("Articles search failed", res.status, "search");
  const data = await res.json();
  return normalizeSearchResponse(data?.data ?? data, query);
}

/**
 * GET /history — search history for logged-in users.
 */
export async function getSearchHistory(
  limit: number = 50
): Promise<{ query: string; category: string; timestamp: string | null }[]> {
  const res = await fetchWithAuth(`${WEB_BASE}/history?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  const raw = data?.data ?? data;
  return Array.isArray(raw?.history) ? raw.history : [];
}

/**
 * GET /search/autocomplete — search suggestions.
 */
export async function searchAutocomplete(
  q: string,
  category: string,
  lang: string
): Promise<string[]> {
  const params = new URLSearchParams({
    q,
    category,
    lang: lang || "en",
  });
  const res = await fetchWithAuth(`${WEB_BASE}/search/autocomplete?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  const list: string[] = data?.data?.suggestions ?? data?.suggestions ?? [];
  return list.slice(0, 7);
}

export interface KnowledgeSummary {
  entity: string;
  domain: string;
  summary: string | null;
  cached: boolean;
}

/**
 * GET /knowledge/summary — AI summary for the knowledge panel.
 */
export async function fetchKnowledgeSummary(
  entity: string,
  domain: string = "allopathy"
): Promise<KnowledgeSummary | null> {
  try {
    const params = new URLSearchParams({ entity, domain });
    const res = await fetchWithAuth(`${WEB_BASE}/knowledge/summary?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.data ?? data;
    return {
      entity: raw?.entity ?? entity,
      domain: raw?.domain ?? domain,
      summary: raw?.summary ?? null,
      cached: raw?.cached ?? false,
    };
  } catch {
    return null;
  }
}
