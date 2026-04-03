/**
 * Manthana API — section-separated client.
 * Re-exports from core, oracle, web, research, clinical, unified.
 * Import from @/lib/api for backward compatibility.
 */

// Core
export { ApiError } from "./core/errors";
export type { ApiEnvelope } from "./core/envelope";
export { fetchWithAuth, fetchApi, getAuthHeaders } from "./core/client";

// Config (for advanced use)
export {
  ORACLE_BASE,
  WEB_BASE,
  RESEARCH_BASE,
  ANALYSIS_BASE,
  CLINICAL_BASE,
  API_BASE,
  API_ORIGIN,
} from "./config";

// Oracle
export {
  streamChat,
  streamM5,
  type ChatModes,
  type StreamSource,
  type ChatResponse,
  type M5DomainAnswer,
  type M5Summary,
} from "./oracle";

// Web
export {
  searchMedical,
  searchPapers,
  searchGuidelines,
  searchTrials,
  searchPdfs,
  searchArticles,
  fetchSearchWithSources,
  searchAutocomplete,
  searchImages,
  searchVideos,
  getSearchHistory,
  getTrending,
  recordClick,
  type SearchResult,
  type ImageResult,
  type VideoResult,
  type SearchResponse,
  type SearchSourcesResponse,
  type TabCounts,
  fetchKnowledgeSummary,
  type KnowledgeSummary,
} from "./web";

// Research
export {
  deepResearch,
  deepResearchStream,
  checkOriginality,
  listResearchThreads,
  createResearchThread,
  deleteResearchThread,
  type DeepResearchRequest,
  type DeepResearchResult,
  type DeepResearchStreamEvent,
  type PlagiarismMatch,
  type PlagiarismResult,
  type ResearchThread,
  type CreateThreadBody,
} from "./research";

// Clinical (includes SNOMED — gateway path under ANALYSIS_BASE)
export {
  checkDrugInteraction,
  checkHerbDrugSafety,
  findClinicalTrials,
  suggestICD10,
  fetchEnrichedDrugInteraction,
  fetchSnomedLookup,
} from "./clinical";

// Unified (gateway-level)
export {
  getHealth,
  getMe,
  getCategories,
  postQuery,
  type QueryResponse,
  type HealthService,
  type HealthResponse,
} from "./unified/client";
