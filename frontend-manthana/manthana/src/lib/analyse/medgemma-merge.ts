import type { AnalysisResponse } from "@/lib/analyse/types";

/** Attach Kimi final narrative + flags after MedGemma Q&A; preserves TXRV `result` fields. */
export function mergeTxrvWithMedgemmaNarrative(
  txrv: AnalysisResponse,
  narrativeReport: string,
  extraModels: string[]
): AnalysisResponse {
  const base =
    typeof txrv.structures === "object" &&
    txrv.structures !== null &&
    !Array.isArray(txrv.structures)
      ? { ...(txrv.structures as Record<string, unknown>) }
      : {};
  const structures: Record<string, unknown> = {
    ...base,
    narrative_report: narrativeReport,
    medgemma_cxr_flow: true,
  };
  const models = [...(txrv.models_used || [])];
  for (const m of extraModels) {
    const t = (m || "").trim();
    if (t && !models.includes(t)) models.push(t);
  }
  return {
    ...txrv,
    structures,
    models_used: models,
  };
}
