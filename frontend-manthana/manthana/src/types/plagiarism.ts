export type PlagiarismState = "idle" | "checking" | "done" | "error";

export interface PlagiarismMatch {
  matchedSentence: string;
  source: string;
  url: string;
  matchPercent: number;
  isCitation: boolean;
  markedAsCitation?: boolean;
}

export interface PlagiarismLayers {
  webSearch: number;
  vectorDB: number;
}

export interface PlagiarismResult {
  originalityScore: number;
  matchedPercent: number;
  matches: PlagiarismMatch[];
  sentencesAnalysed: number;
  sourcesSearched: number;
  layers: PlagiarismLayers;
  scanDate: string;
  note: string;
  error?: string;
}

