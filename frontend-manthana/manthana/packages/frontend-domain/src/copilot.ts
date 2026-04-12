import type { AnalysisResponse } from "@manthana/api";

// Build a stable context object for POST /copilot from an AnalysisResponse.
export function buildCopilotContextFromAnalysis(
  result: AnalysisResponse | null | undefined
): Record<string, unknown> {
  if (!result) return {};
  const { modality, findings, impression, pathology_scores, structures } = result;
  return {
    modality,
    findings,
    impression,
    pathology_scores,
    structures,
  };
}

export function defaultCopilotQuestion(
  _result?: AnalysisResponse | null
): string {
  return "Summarise the key imaging findings and impression for this case in plain language for a referring clinician.";
}

