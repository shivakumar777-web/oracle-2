/**
 * Maps AI orchestration output (AIInterpretationReport) into the universal JSON
 * consumed by manthana_report_engine.html renderReport().
 */
import type { AIInterpretationReport } from "@/lib/analyse/types";
import type { OracleLabsHandoffPayload } from "@/lib/analyse/oracle-handoff";
import {
  DEFAULT_ORACLE_FOLLOWUP_FROM_LABS,
  formatAIInterpretationReportForOracle,
} from "@/lib/analyse/oracle-handoff";

export const MANTHANA_REPORT_ENGINE_STORAGE_KEY = "manthana_report_engine_v1";

/**
 * Cross-tab handoff: payload is stored under this prefix + id, and the report engine
 * is opened with ?handoff=<id>. sessionStorage is not shared with a new tab from
 * window.open(), so localStorage is required for that flow.
 */
export const MANTHANA_REPORT_ENGINE_HANDOFF_PREFIX = "manthana_report_engine_handoff_";

/** Max embedded image size for data URLs (sessionStorage + standalone HTML). */
export const MAX_SOURCE_IMAGE_BYTES = 2_500_000;

export type EngineSourceMedia = {
  kind: "image";
  data_url: string;
  alt?: string;
  caption?: string;
};

export type ReportEngineSessionPayload = {
  modalityKey: string;
  modalityLabel: string;
  patientId: string;
  enginePayload: Record<string, unknown>;
  oracleHandoff: OracleLabsHandoffPayload;
  createdAt: number;
};

function sevFromOrchestration(
  level: AIInterpretationReport["severity"]["level"]
): "critical" | "significant" | "moderate" | "mild" {
  switch (level) {
    case "critical":
      return "critical";
    case "urgent":
      return "significant";
    case "moderate":
      return "moderate";
    case "incidental":
    default:
      return "mild";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DYNAMIC_SECTION_BODY_MAX = 1500;

function truncateDynamicBody(s: string): string {
  if (s.length <= DYNAMIC_SECTION_BODY_MAX) return s;
  return `${s.slice(0, DYNAMIC_SECTION_BODY_MAX)}…`;
}

/**
 * Build engine JSON + Oracle handoff payload for sessionStorage → report engine page.
 */
export function interpretationReportToEnginePayload(
  report: AIInterpretationReport,
  opts: {
    modalityKey: string;
    modalityLabel: string;
    patientId: string;
    sourceImageDataUrl?: string | null;
  }
): ReportEngineSessionPayload {
  const primarySev = sevFromOrchestration(report.severity?.level ?? "incidental");
  const findings: Array<{ title: string; severity: string; body: string }> = [];

  for (const f of report.findings?.primary ?? []) {
    const parts = [
      escapeHtml(f.description || ""),
      f.measurement ? `<br><em>${escapeHtml(f.measurement)}</em>` : "",
      f.significance
        ? `<br><span style="color:var(--text-muted)">${escapeHtml(f.significance)}</span>`
        : "",
    ];
    findings.push({
      title: f.location || "Finding",
      severity:
        primarySev === "critical" || primarySev === "significant"
          ? primarySev
          : "significant",
      body: parts.join(""),
    });
  }

  for (const f of report.findings?.secondary ?? []) {
    findings.push({
      title: f.location || "Secondary finding",
      severity: "moderate",
      body: `${escapeHtml(f.description || "")}${
        f.significance
          ? `<br><span style="color:var(--text-muted)">${escapeHtml(f.significance)}</span>`
          : ""
      }`,
    });
  }

  const neg = report.findings?.negative_pertinents?.filter(Boolean) ?? [];
  if (neg.length) {
    findings.push({
      title: "Negative pertinents",
      severity: "mild",
      body: `<ul style="margin:0;padding-left:18px">${neg.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`,
    });
  }

  const pd = report.impressions?.primary_diagnosis;
  const differentials = report.impressions?.differentials ?? [];

  const diffRows = [
    pd
      ? {
          rank: 1,
          name: escapeHtml(pd.name),
          detail: escapeHtml(pd.evidence || pd.reasoning || "Primary diagnosis"),
          probability: Math.min(100, Math.max(0, pd.confidence_pct)),
        }
      : null,
    ...differentials.map((d, i) => ({
      rank: i + 2,
      name: escapeHtml(d.name),
      detail: escapeHtml(d.reasoning || ""),
      probability: Math.min(100, Math.max(0, d.confidence_pct)),
    })),
  ].filter(Boolean) as Array<{
    rank: number;
    name: string;
    detail: string;
    probability: number;
  }>;

  const impPoints: string[] = [];
  if (pd?.evidence) impPoints.push(pd.evidence);
  if (pd?.reasoning) impPoints.push(pd.reasoning);
  for (const d of differentials.slice(0, 4)) {
    impPoints.push(`${d.name} (${d.confidence_pct}%)${d.reasoning ? ` — ${d.reasoning}` : ""}`);
  }

  const triage = report.severity?.triage_action
    ? [
        {
          icon: "⚠️",
          title: "Triage",
          text: escapeHtml(report.severity.triage_action),
        },
      ]
    : [];

  const nextReco = (report.next_steps ?? []).map((n) => {
    const pri =
      n.priority === "immediate" ? "🔴" : n.priority === "soon" ? "🟠" : "🟢";
    return {
      icon: pri,
      title: escapeHtml(n.action),
      text: escapeHtml(n.reasoning || ""),
    };
  });

  const models = report.models_used ?? [];
  const model1 = models[0] ?? "interpreter";
  const model2 = models[1] ?? "";

  const reportId = `RPT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-4)}`;

  const cc = report.clinical_correlation;
  const educational =
    cc && (cc.supports_history || cc.additional_context_needed)
      ? {
          title: "Clinical correlation",
          items: [
            ...(cc.supports_history
              ? [
                  {
                    heading: "Supports history",
                    text: escapeHtml(cc.supports_history),
                  },
                ]
              : []),
            ...(cc.contradicts_history
              ? [
                  {
                    heading: "Contradicts / tension",
                    text: escapeHtml(cc.contradicts_history),
                  },
                ]
              : []),
            ...(cc.additional_context_needed
              ? [
                  {
                    heading: "Additional context",
                    text: escapeHtml(cc.additional_context_needed),
                  },
                ]
              : []),
          ],
        }
      : undefined;

  const criticalAlert =
    report.severity?.level === "critical" || report.severity?.level === "urgent"
      ? {
          title: "Priority",
          description: escapeHtml(
            report.severity.triage_action || "Review clinically urgent findings."
          ),
        }
      : null;

  const enginePayload: Record<string, unknown> = {
    modality_key: opts.modalityKey,
    report_meta: {
      report_id: reportId,
      report_date: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      report_type: opts.modalityLabel,
      confidence:
        pd && pd.confidence_pct >= 75
          ? "High"
          : pd && pd.confidence_pct >= 45
            ? "Moderate"
            : "Low",
      confidence_score: pd ? `${pd.confidence_pct}%` : "—",
      model1,
      model2: model2 || undefined,
      cost: undefined,
    },
    patient: {
      id: opts.patientId,
      clinical_history: "See interrogation answers and clinical correlation above.",
    },
    critical_alert: criticalAlert,
    technique: [
      { label: "Modality", value: opts.modalityLabel },
      { label: "Pipeline", value: "Manthana AI interpretation" },
    ],
    findings,
    measurements: [] as unknown[],
    differential_diagnosis: diffRows,
    impression: {
      primary_diagnosis: pd?.name ? escapeHtml(pd.name) : "See findings",
      points: impPoints.map((p) => escapeHtml(p)),
    },
    recommendations: [...triage, ...nextReco],
    educational_note: educational,
    dynamic_sections: (report.dynamic_sections ?? []).slice(0, 5).map((s) => ({
      id: escapeHtml(s.id ?? ""),
      title: escapeHtml(s.title ?? ""),
      body: escapeHtml(truncateDynamicBody(String(s.body ?? ""))),
      emphasis: s.emphasis ?? "info",
    })),
  };

  if (opts.sourceImageDataUrl) {
    (enginePayload as { source_media: EngineSourceMedia }).source_media = {
      kind: "image",
      data_url: opts.sourceImageDataUrl,
      alt: "Study image",
      caption: `Source upload · ${opts.modalityLabel}`,
    };
  }

  const reportMarkdown = formatAIInterpretationReportForOracle(report, {
    modalityLabel: opts.modalityLabel,
    patientId: opts.patientId,
  });

  const oracleHandoff: OracleLabsHandoffPayload = {
    reportMarkdown,
    suggestedFollowUp: DEFAULT_ORACLE_FOLLOWUP_FROM_LABS,
    scanKind: "single",
    labsModalityLabel: opts.modalityLabel,
    patientId: opts.patientId,
  };

  return {
    modalityKey: opts.modalityKey,
    modalityLabel: opts.modalityLabel,
    patientId: opts.patientId,
    enginePayload,
    oracleHandoff,
    createdAt: Date.now(),
  };
}
