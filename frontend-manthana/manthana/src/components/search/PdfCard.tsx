"use client";

import React from "react";
import Link from "next/link";
import type { SearchResult } from "@/lib/api";
import { toViewerHref } from "@/lib/viewer-url";

interface PdfCardProps {
  result: SearchResult;
  currentDomain: string;
  onRecordClick?: (result: SearchResult, idx: number) => void;
  idx?: number;
}

export function PdfCard({ result, currentDomain, onRecordClick, idx = 0 }: PdfCardProps) {
  const viewerHref = result.url ? toViewerHref(result.url) : null;
  const { badge, badgeClass } = getPdfBadge(result);

  return (
    <article
      role="article"
      className="glass rounded-xl p-5 hover:bg-white/[0.06] hover:scale-[1.005] transition-all duration-200 group"
      aria-labelledby={`pdf-title-${idx}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`pill text-[9px] px-2 py-0.5 ${badgeClass}`}>
          {badge}
        </span>
        <span className="font-ui text-[10px] text-cream/25 uppercase tracking-wider">
          {result.domain ?? result.source ?? "PDF"}
        </span>
      </div>

      <h3 id={`pdf-title-${idx}`} className="font-ui text-sm font-medium text-cream/80 group-hover:text-gold-h transition-colors mb-2 leading-snug">
        {result.url ? (
          viewerHref ? (
            <Link
              href={viewerHref}
              onClick={() => onRecordClick?.(result, idx)}
              className="hover:text-gold-h"
            >
              {result.title}
            </Link>
          ) : (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onRecordClick?.(result, idx)}
              className="hover:text-gold-h"
            >
              {result.title}
            </a>
          )
        ) : (
          result.title
        )}
      </h3>

      <p className="font-body text-xs text-cream/35 leading-relaxed line-clamp-2">
        {result.snippet}
      </p>

      <div className="flex items-center gap-4 mt-3 flex-wrap">
        <span className="font-ui text-[10px] text-cream/20">
          {result.publishedDate ?? ""}
        </span>
        {(result.trustScore ?? 0) > 0 && (
          <>
            <div className="flex-1 min-w-[60px] max-w-[100px] h-1 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold-s to-gold-h rounded-full transition-all"
                style={{ width: `${result.trustScore}%` }}
              />
            </div>
            <span className="font-ui text-[10px] text-gold/60">
              {result.trustScore}% trust
            </span>
          </>
        )}
        <Link
          href={`/?q=${encodeURIComponent(`Explain: ${result.title} — focus on key findings.`)}&domain=${currentDomain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto font-ui text-[10px] text-teal-h underline underline-offset-2 decoration-teal/60 hover:text-teal-p"
        >
          Ask Oracle in new tab →
        </Link>
      </div>
    </article>
  );
}

function getPdfBadge(result: { source?: string; domain?: string }): { badge: string; badgeClass: string } {
  const source = (result.source ?? result.domain ?? "").toLowerCase();
  if (source.includes("pubmed") || source.includes("pmc") || source.includes("ncbi")) return { badge: "RESEARCH", badgeClass: "badge-research" };
  if (source.includes("europepmc")) return { badge: "EUROPE PMC", badgeClass: "badge-research" };
  return { badge: "PDF", badgeClass: "badge-research" };
}
