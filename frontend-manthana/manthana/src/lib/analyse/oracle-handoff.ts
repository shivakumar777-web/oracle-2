/**
 * One-time handoff from Manthana Labs (/analyse) → Manthana Oracle (/).
 * Uses sessionStorage + ?labsHandoff=1 so the Oracle page can seed chat context.
 */
import type { AnalysisResponse, UnifiedAnalysisResult } from "@/lib/analyse/types";
import { MODALITIES } from "@/lib/analyse/constants";
import { uniqueFormattedLabsModels } from "@/lib/analyse/display-models";

export const ORACLE_LABS_HANDOFF_STORAGE_KEY = "manthana_oracle_labs_handoff_v1";
/** Query flag consumed once on Oracle home to load handoff from sessionStorage */
export const ORACLE_LABS_HANDOFF_QUERY = "labsHandoff";

export type OracleLabsHandoffPayload = {
  reportMarkdown: string;
  suggestedFollowUp: string;
  scanKind: "single" | "multi";
  labsModalityLabel: string;
  patientId: string;
  labsSessionId?: string;
};

const MAX_STORE_CHARS = 4_000_000;

function modalityLabel(id: string): string {
  const direct = MODALITIES.find((m) => m.id === id);
  if (direct) return direct.label;
  if (id === "mri") return MODALITIES.find((m) => m.id === "brain_mri")?.label ?? id;
  return id.replace(/_/g, " ");
}

function confidencePct(c: number): number {
  if (!Number.isFinite(c)) return 0;
  return c <= 1 ? Math.round(c * 100) : Math.round(c);
}

function truncateForStorage(text: string): string {
  if (text.length <= MAX_STORE_CHARS) return text;
  return `${text.slice(0, MAX_STORE_CHARS)}\n\n…[truncated — report exceeded local storage safe size]`;
}

export function formatSingleLabsReportForOracle(
  result: AnalysisResponse,
  opts: { uiModalityId?: string; patientId: string }
): string {
  const modLabel = modalityLabel(opts.uiModalityId ?? result.modality);
  const lines: string[] = [];
  lines.push("## Manthana Labs — AI imaging summary (conventional / Allopathy view)");
  lines.push("");
  lines.push(
    "_Educational and decision-support context only. Not a substitute for a certified radiology report or clinical judgment._"
  );
  lines.push("");
  lines.push(`**Case / patient ID:** ${opts.patientId || "ANONYMOUS"}`);
  lines.push(`**Modality (Labs):** ${modLabel} (\`${result.modality}\`)`);
  if (result.detected_region) lines.push(`**Region (if stated):** ${result.detected_region}`);
  lines.push("");
  lines.push("### Findings");
  if (result.findings?.length) {
    for (const f of result.findings) {
      const desc = f.description?.trim() || "—";
      lines.push(
        `- **${f.label}** · ${f.severity} · confidence ~${confidencePct(f.confidence)}%${f.region ? ` · _${f.region}_` : ""} — ${desc}`
      );
    }
  } else {
    lines.push("_No structured findings list returned._");
  }
  lines.push("");
  lines.push("### Impression");
  lines.push(result.impression || "_None stated._");
  lines.push("");
  const st = result.structures;
  if (
    typeof st === "object" &&
    st !== null &&
    !Array.isArray(st) &&
    typeof (st as Record<string, unknown>).narrative_report === "string" &&
    String((st as Record<string, unknown>).narrative_report).trim()
  ) {
    lines.push("### AI interpretation report (MedGemma + Kimi)");
    lines.push(String((st as Record<string, unknown>).narrative_report).trim());
    lines.push("");
  }
  if (result.critical_values?.length) {
    lines.push("### Critical values / flags");
    lines.push(result.critical_values.map((x) => `- ${x}`).join("\n"));
    lines.push("");
  }
  if (result.models_used?.length) {
    lines.push(`**Models used (Labs):** ${uniqueFormattedLabsModels(result.models_used).join(", ")}`);
    lines.push("");
  }
  if (result.disclaimer) {
    lines.push("### Labs disclaimer");
    lines.push(result.disclaimer);
  }
  return lines.join("\n");
}

export function formatUnifiedLabsReportForOracle(
  unified: UnifiedAnalysisResult,
  patientId: string
): string {
  const lines: string[] = [];
  lines.push("## Manthana Labs — unified multi-modality AI summary (conventional / Allopathy view)");
  lines.push("");
  lines.push(
    "_Educational and decision-support context only. Not a substitute for a certified radiology report or clinical judgment._"
  );
  lines.push("");
  lines.push(`**Case / patient ID:** ${patientId || unified.patient_id || "ANONYMOUS"}`);
  lines.push(`**Modalities analyzed:** ${unified.modalities_analyzed?.join(", ") || "—"}`);
  lines.push("");
  lines.push("### Per-modality impressions");
  for (const block of unified.individual_reports ?? []) {
    lines.push(`#### ${modalityLabel(block.modality)}`);
    lines.push(block.findings_summary || "—");
    lines.push("");
    lines.push(`_Impression:_ ${block.impression || "—"}`);
    lines.push("");
  }
  lines.push("### Unified assessment");
  lines.push(unified.unified_diagnosis || "—");
  lines.push("");
  lines.push("### Unified findings");
  lines.push(unified.unified_findings || "—");
  lines.push("");
  lines.push("### Risk");
  lines.push(unified.risk_assessment || "—");
  lines.push("");
  lines.push("### Treatment suggestions (Allopathy-oriented)");
  lines.push(unified.treatment_recommendations || "—");
  lines.push("");
  lines.push("### Prognosis");
  lines.push(unified.prognosis || "—");
  lines.push("");
  if (unified.cross_modality_correlations) {
    lines.push("### Cross-modality correlations");
    lines.push(unified.cross_modality_correlations);
    lines.push("");
  }
  if (unified.models_used?.length) {
    lines.push(`**Models used (Labs):** ${uniqueFormattedLabsModels(unified.models_used).join(", ")}`);
  }
  return lines.join("\n");
}

/** Follow-up when the Labs handoff includes a MedGemma + Kimi chest narrative (do not re-write the full report). */
export const MEDGEMMA_ORACLE_FOLLOWUP_FROM_LABS =
  "The user already has a **structured chest X-ray report** above (TorchXRayVision scores + optional Q&A + Kimi narrative). " +
  "Use it as the primary imaging context. **Do not reproduce the entire report** unless asked. " +
  "Clarify uncertainties, discuss differentials and follow-up, and align with the domain selector (M5 vs single tradition). " +
  "Note limitations of single-view AI and encourage in-person care when appropriate.";

export const DEFAULT_ORACLE_FOLLOWUP_FROM_LABS =
  "Using the Manthana Labs report above as the primary imaging context, give structured interpretations aligned with how I have set the domain selector:\n\n" +
  "- If **M5 — All 5** is selected: respond with clear sections for **Allopathy** (concise recap tied to findings), **Ayurveda**, **Homeopathy**, **Siddha**, and **Unani**. Each section should relate explicitly to the imaging findings and impression, note limitations and uncertainty, and use appropriate clinical terminology.\n" +
  "- If a **single** domain is selected: give a full answer only in that tradition, still grounded in the same imaging report.\n\n" +
  "Match the app language where applicable. Do not invent findings not supported by the report.";

export function storeOracleLabsHandoff(payload: OracleLabsHandoffPayload): void {
  if (typeof window === "undefined") return;
  const body = truncateForStorage(payload.reportMarkdown);
  const toSave: OracleLabsHandoffPayload = {
    ...payload,
    reportMarkdown: body,
  };
  try {
    sessionStorage.setItem(ORACLE_LABS_HANDOFF_STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    sessionStorage.setItem(
      ORACLE_LABS_HANDOFF_STORAGE_KEY,
      JSON.stringify({
        ...toSave,
        reportMarkdown:
          toSave.reportMarkdown.slice(0, 500_000) +
          "\n\n…[truncated — browser storage quota exceeded]",
      })
    );
  }
}

export function consumeOracleLabsHandoff(): OracleLabsHandoffPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ORACLE_LABS_HANDOFF_STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(ORACLE_LABS_HANDOFF_STORAGE_KEY);
  try {
    const o = JSON.parse(raw) as OracleLabsHandoffPayload;
    if (!o?.reportMarkdown || typeof o.reportMarkdown !== "string") return null;
    return o;
  } catch {
    return null;
  }
}
