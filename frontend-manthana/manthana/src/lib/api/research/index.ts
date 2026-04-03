/**
 * Research section API — deep research, originality.
 */

export {
  deepResearch,
  deepResearchStream,
  checkOriginality,
  type DeepResearchRequest,
  type DeepResearchResult,
  type DeepResearchStreamEvent,
  type PlagiarismMatch,
  type PlagiarismResult,
} from "./client";

export {
  listResearchThreads,
  createResearchThread,
  deleteResearchThread,
  type ResearchThread,
  type CreateThreadBody,
} from "./threads";
