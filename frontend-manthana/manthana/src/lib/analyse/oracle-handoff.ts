/**
 * One-time handoff from Manthana Labs (/analyse) → Manthana Oracle (/).
 * Uses sessionStorage + ?labsHandoff=1 so the Oracle page can seed chat context.
 */
import type {
  AIInterpretationReport,
  AnalysisResponse,
  UnifiedAnalysisResult,
} from "@/lib/analyse/types";
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

/** Markdown summary of the 95-modality AI interpreter JSON for Manthana Oracle (M5 handoff). */
export function formatAIInterpretationReportForOracle(
  report: AIInterpretationReport,
  opts: { modalityLabel: string; patientId: string }
): string {
  const lines: string[] = [];
  lines.push("## Manthana Labs — AI structured interpretation (final report)");
  lines.push("");
  lines.push(
    "_Educational and decision-support context only. Not a substitute for a certified diagnostic report or clinical judgment._"
  );
  lines.push("");
  lines.push(`**Patient / case ID:** ${opts.patientId || "ANONYMOUS"}`);
  lines.push(`**Modality:** ${opts.modalityLabel}`);
  lines.push("");
  const sev = report.severity;
  if (sev) {
    lines.push("### Severity & triage");
    lines.push(
      `- **Level:** ${sev.level} · **Time sensitivity:** ${sev.time_sensitivity} · **Action:** ${sev.triage_action}`
    );
    lines.push("");
  }
  lines.push("### Findings — primary");
  const prim = report.findings?.primary ?? [];
  if (prim.length) {
    for (const f of prim) {
      lines.push(
        `- **${f.location}** — ${f.description}${f.measurement ? ` (${f.measurement})` : ""} · _${f.significance}_`
      );
    }
  } else {
    lines.push("_None listed._");
  }
  lines.push("");
  lines.push("### Findings — secondary");
  const sec = report.findings?.secondary ?? [];
  if (sec.length) {
    for (const f of sec) {
      lines.push(`- **${f.location}** — ${f.description} · _${f.significance}_`);
    }
  } else {
    lines.push("_None listed._");
  }
  lines.push("");
  const neg = report.findings?.negative_pertinents?.filter(Boolean) ?? [];
  if (neg.length) {
    lines.push("### Negative pertinents");
    lines.push(neg.map((n) => `- ${n}`).join("\n"));
    lines.push("");
  }
  const imp = report.impressions;
  if (imp?.primary_diagnosis) {
    lines.push("### Impression — primary diagnosis");
    const p = imp.primary_diagnosis;
    lines.push(
      `- **${p.name}** (${p.confidence_pct}% confidence)${p.icd10 ? ` · ICD-10: \`${p.icd10}\`` : ""}`
    );
    if (p.evidence) lines.push(`  - Evidence: ${p.evidence}`);
    if (p.reasoning) lines.push(`  - Reasoning: ${p.reasoning}`);
    lines.push("");
  }
  if (imp?.differentials?.length) {
    lines.push("### Differentials");
    for (const d of imp.differentials) {
      lines.push(`- **${d.name}** (${d.confidence_pct}%)${d.reasoning ? ` — ${d.reasoning}` : ""}`);
    }
    lines.push("");
  }
  const cc = report.clinical_correlation;
  if (cc) {
    lines.push("### Clinical correlation");
    if (cc.supports_history) lines.push(`- Supports history: ${cc.supports_history}`);
    if (cc.contradicts_history) lines.push(`- Tension / contradicts: ${cc.contradicts_history}`);
    if (cc.additional_context_needed)
      lines.push(`- Additional context: ${cc.additional_context_needed}`);
    lines.push("");
  }
  if (report.next_steps?.length) {
    lines.push("### Next steps");
    for (const n of report.next_steps) {
      lines.push(`- **[${n.priority}]** ${n.action} — ${n.reasoning}`);
    }
    lines.push("");
  }
  if (report.dynamic_sections?.length) {
    lines.push("### Clinical intelligence");
    for (const s of report.dynamic_sections.slice(0, 5)) {
      const raw = (s.body ?? "").trim();
      const body = raw.length > 1500 ? `${raw.slice(0, 1500)}…` : raw;
      lines.push(`#### ${s.title}`);
      lines.push(body);
      lines.push("");
    }
  }
  if (report.research_references?.length) {
    lines.push("### References");
    for (const r of report.research_references) {
      lines.push(`- [${r.title}](${r.url}) (${r.journal}, ${r.year}) — ${r.relevance}`);
    }
    lines.push("");
  }
  if (report.indian_clinical_notes?.trim()) {
    lines.push("### Regional / India clinical notes");
    lines.push(report.indian_clinical_notes.trim());
    lines.push("");
  }
  if (report.models_used?.length) {
    lines.push(`**Models:** ${uniqueFormattedLabsModels(report.models_used).join(", ")}`);
    lines.push("");
  }
  if (report.disclaimer?.trim()) {
    lines.push("### Disclaimer");
    lines.push(report.disclaimer.trim());
  }
  return lines.join("\n");
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
