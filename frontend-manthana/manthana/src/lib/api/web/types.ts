/**
 * Web section — search result types.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  domain: string;
  engine: string;
  publishedDate: string | null;
  trustScore: number;
  isPeerReviewed: boolean;
  isOfficial: boolean;
  isOpenAccess: boolean;
  thumbnail: string | null;
  type: "article" | "video" | "image" | "pdf" | "trial" | "guideline";
  relevance?: number;
  date?: string;
  /** Last-resort web rows in Papers tab */
  paperFallback?: boolean;
  /** Broadened SearXNG rows in Guidelines tab */
  guidelineFallback?: boolean;
  /** SearXNG-supplemented rows in Trials tab */
  trialsFallback?: boolean;
  /** e.g. DOAJ, CORE, Wikidata */
  sourceBadge?: string;
}

export interface ImageResult {
  url: string;
  title: string;
  source: string;
  sourceUrl: string;
  thumbnail: string;
}

export interface VideoResult {
  url: string;
  title: string;
  thumbnail: string;
  source: string;
  publishedDate: string;
}

export interface TabCounts {
  all?: number;
  papers?: number;
  guidelines?: number;
  trials?: number;
  images?: number;
  videos?: number;
  pdfs?: number;
  articles?: number;
}

export interface SearchResponse {
  query: string;
  category: string;
  total: number;
  page: number;
  results: SearchResult[];
  images: ImageResult[];
  videos: VideoResult[];
  relatedQuestions: string[];
  enginesUsed: string[];
  localResults: SearchResult[];
  elapsed: number;
  synthesis: null;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  tabCounts?: TabCounts;
  nextPageToken?: string;
  /** Tab-level: response used broadened web fallback */
  paperFallback?: boolean;
  guidelineFallback?: boolean;
  trialsFallback?: boolean;
}

export interface SearchSourcesResponse {
  sources?: Array<{ title?: string; url?: string; source?: string }>;
  results?: Array<{ title?: string; url?: string; source?: string }>;
  answer?: string;
  confidence?: number;
}
