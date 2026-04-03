/**
 * MANTHANA API Client — re-export layer.
 * Section-separated implementation lives in api/.
 * Import from @/lib/api for backward compatibility.
 */

export {
  ApiError,
  fetchWithAuth,
  fetchApi,
  getAuthHeaders,
  streamChat,
  streamM5,
  searchMedical,
  fetchSearchWithSources,
  searchAutocomplete,
  searchImages,
  searchVideos,
  getSearchHistory,
  getTrending,
  recordClick,
  deepResearch,
  deepResearchStream,
  checkOriginality,
  listResearchThreads,
  createResearchThread,
  deleteResearchThread,
  checkDrugInteraction,
  checkHerbDrugSafety,
  findClinicalTrials,
  suggestICD10,
  fetchEnrichedDrugInteraction,
  fetchSnomedLookup,
  getHealth,
  getMe,
  getCategories,
  postQuery,
} from "./api/index";

export type {
  ApiEnvelope,
  ChatModes,
  StreamSource,
  ChatResponse,
  M5DomainAnswer,
  M5Summary,
  SearchResult,
  ImageResult,
  VideoResult,
  SearchResponse,
  SearchSourcesResponse,
  DeepResearchRequest,
  DeepResearchResult,
  DeepResearchStreamEvent,
  PlagiarismMatch,
  PlagiarismResult,
  ResearchThread,
  CreateThreadBody,
  QueryResponse,
  HealthService,
  HealthResponse,
} from "./api/index";

export type { SnomedConcept } from "@/types/clinical-tools";
