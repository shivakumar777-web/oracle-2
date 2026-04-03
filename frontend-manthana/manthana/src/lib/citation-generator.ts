/**
 * citation-generator.ts
 * Vancouver citation format generator for Manthana Web search results.
 * Runs fully client-side — no API calls, no LLM.
 */

import type { SearchResult } from "./api";

/**
 * Generate a Vancouver-style citation for a search result.
 * Format: Author(s). Title. [Internet]. Year [cited Date]. Available from: URL
 */
export function generateVancouverCitation(result: SearchResult): string {
  const author = result.source || "Unknown";
  const title = result.title || "Untitled";
  const year =
    result.publishedDate
      ? new Date(result.publishedDate).getFullYear().toString()
      : "n.d.";
  const accessed = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const url = result.url;

  return `${author}. ${title}. [Internet]. ${year} [cited ${accessed}]. Available from: ${url}`;
}

/**
 * Copy a Vancouver citation to the clipboard.
 * Returns the citation string so callers can show a toast.
 */
export async function copyCitation(result: SearchResult): Promise<string> {
  const citation = generateVancouverCitation(result);
  try {
    await navigator.clipboard.writeText(citation);
  } catch {
    // Fallback for browsers that block clipboard API without HTTPS
    const el = document.createElement("textarea");
    el.value = citation;
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
  return citation;
}
