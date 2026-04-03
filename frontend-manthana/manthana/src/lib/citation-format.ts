/**
 * Format reference list lines for common biomedical citation styles.
 * Uses available fields (authors, title, journal, year, doi, pmid, url).
 */

import type { CitationStyle } from "@/lib/deep-research-config";

export type CitationFormatKey =
  | CitationStyle
  | "ieee"
  | "chicago"
  | "vancouver";

export interface CitationLike {
  id?: number;
  authors: string;
  title: string;
  journal?: string;
  year?: number;
  doi?: string;
  pmid?: string;
  url?: string;
}

/** Normalize API / legacy style strings to a known formatter key. */
export function normalizeCitationFormatKey(
  s: string | undefined | null,
): CitationFormatKey {
  const k = (s || "vancouver").toLowerCase().trim();
  if (
    k === "apa" ||
    k === "mla" ||
    k === "icmr" ||
    k === "harvard" ||
    k === "ieee" ||
    k === "chicago"
  ) {
    return k as CitationFormatKey;
  }
  return "vancouver";
}

function authorsApaStyle(authors: string): string {
  const a = authors.trim();
  if (!a) return "Unknown.";
  const parts = a.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return `${parts[0] ?? a}.`;
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(", ");
  return `${rest}, & ${last}.`;
}

/** Short label for UI chips (Vancouver, APA, …). */
export function citationStyleLabel(key: CitationFormatKey): string {
  const map: Record<string, string> = {
    vancouver: "Vancouver",
    apa: "APA",
    mla: "MLA",
    icmr: "ICMR",
    harvard: "Harvard",
    ieee: "IEEE",
    chicago: "Chicago",
  };
  return map[key] ?? key;
}

/**
 * Heuristic source-type badges for evidence / provenance (UI only).
 */
export function getSourceBadges(c: CitationLike): { key: string; label: string }[] {
  const badges: { key: string; label: string }[] = [];
  const journal = (c.journal || "").toLowerCase();
  const url = (c.url || "").toLowerCase();

  if (c.pmid) badges.push({ key: "pubmed", label: "PubMed" });
  if (journal.includes("cochrane")) badges.push({ key: "cochrane", label: "Cochrane" });
  if (url.includes("clinicaltrials.gov")) {
    badges.push({ key: "clinicaltrials", label: "Clinical trial" });
  }
  if (c.doi && !badges.some((b) => b.key === "doi")) {
    badges.push({ key: "doi", label: "DOI" });
  }
  return badges;
}

/**
 * One numbered reference line for export / clipboard.
 */
export function formatCitationLine(
  style: CitationFormatKey,
  index: number,
  c: CitationLike,
): string {
  const authors = (c.authors || "Unknown").trim();
  const title = (c.title || "Untitled").trim();
  const journal = (c.journal || "").trim();
  const year = c.year != null && c.year > 0 ? String(c.year) : "n.d.";
  const doiPart = c.doi
    ? style === "apa" || style === "harvard"
      ? ` https://doi.org/${c.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}`
      : ` doi:${c.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}`
    : "";
  const pmidPart = c.pmid ? ` PMID: ${c.pmid}.` : "";

  switch (style) {
    case "ieee":
      return `[${index}] ${authors}, "${title}," ${journal || "Source"}, ${year}.${doiPart}${pmidPart}`;

    case "apa":
    case "harvard": {
      const apaAuthors = authorsApaStyle(authors);
      const j = journal ? ` ${journal}.` : "";
      return `${index}. ${apaAuthors} (${year}). ${title}.${j}${doiPart}${pmidPart}`.trim();
    }

    case "mla": {
      return `${index}. ${authors}. "${title}." ${journal || "Journal"}, ${year}.${doiPart}`;
    }

    case "icmr":
    case "vancouver":
    default: {
      const j = journal ? ` ${journal}.` : "";
      return `${index}. ${authors}. ${title}.${j} ${year}.${doiPart}${pmidPart}`.trim();
    }

    case "chicago": {
      const j = journal ? ` ${journal}` : "";
      return `${index}. ${authors}. "${title}."${j} (${year}).${doiPart}${pmidPart}`.trim();
    }
  }
}

/** Full numbered reference list for copy / download. */
export function formatReferencesList(
  citations: CitationLike[],
  style: CitationFormatKey,
): string {
  if (!citations?.length) return "";
  const key = normalizeCitationFormatKey(style);
  return citations
    .map((c, i) => formatCitationLine(key, i + 1, c))
    .join("\n\n");
}
