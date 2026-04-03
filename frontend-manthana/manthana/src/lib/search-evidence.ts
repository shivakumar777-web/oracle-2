/**
 * Derive evidence level from result title/snippet for display badges.
 * Parses common publication types from PubMed and academic sources.
 */

export type EvidenceLevel =
  | "systematic-review"
  | "rct"
  | "meta-analysis"
  | "case-report"
  | "expert-opinion"
  | "guideline"
  | null;

export function getEvidenceLevel(result: {
  title?: string;
  snippet?: string;
  type?: string;
}): EvidenceLevel {
  const title = (result.title ?? "").toLowerCase();
  const snippet = (result.snippet ?? "").toLowerCase();
  const combined = `${title} ${snippet}`;
  const type = (result.type ?? "").toLowerCase();

  if (type === "guideline") return "guideline";

  if (
    /systematic review|systematic literature review|systematic meta-analysis/i.test(combined)
  ) {
    return "systematic-review";
  }
  if (
    /meta-analysis|meta analysis|metaanalysis/i.test(combined)
  ) {
    return "meta-analysis";
  }
  if (
    /randomized controlled trial|randomised controlled trial|rct\b|randomized clinical trial|double-blind|placebo-controlled trial/i.test(combined)
  ) {
    return "rct";
  }
  if (
    /case report|case series|case study\b/i.test(combined)
  ) {
    return "case-report";
  }
  if (
    /expert opinion|consensus statement|narrative review|review article/i.test(combined)
  ) {
    return "expert-opinion";
  }

  return null;
}

export function getEvidenceBadge(level: EvidenceLevel): {
  label: string;
  className: string;
} | null {
  if (!level) return null;
  const map: Record<NonNullable<EvidenceLevel>, { label: string; className: string }> = {
    "systematic-review": {
      label: "Systematic Review",
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    "meta-analysis": {
      label: "Meta-Analysis",
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    rct: {
      label: "RCT",
      className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
    "case-report": {
      label: "Case Report",
      className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    "expert-opinion": {
      label: "Expert Opinion",
      className: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    },
    guideline: {
      label: "Guideline",
      className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    },
  };
  return map[level] ?? null;
}
