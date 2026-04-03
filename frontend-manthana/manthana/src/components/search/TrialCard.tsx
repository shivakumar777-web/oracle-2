"use client";

import React from "react";
import Link from "next/link";
import type { SearchResult } from "@/lib/api";
import { toViewerHref } from "@/lib/viewer-url";

interface TrialCardProps {
  result: SearchResult;
  currentDomain: string;
  onRecordClick?: (result: SearchResult, idx: number) => void;
  idx?: number;
}

export function TrialCard({ result, currentDomain, onRecordClick, idx = 0 }: TrialCardProps) {
  const viewerHref = result.url ? toViewerHref(result.url) : null;
  const phase = (result as SearchResult & { phase?: string }).phase ?? "";
  const status = (result as SearchResult & { status?: string }).status ?? "";
  const enrollment = (result as SearchResult & { enrollment?: number }).enrollment;

  return (
    <article
      role="article"
      className="glass rounded-xl p-5 hover:bg-white/[0.06] hover:scale-[1.005] transition-all duration-200 group border-l-4 border-teal/40"
      aria-labelledby={`trial-title-${idx}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="pill text-[9px] px-2 py-0.5 badge-research">TRIAL</span>
        {status && (
          <span className="font-ui text-[9px] text-teal/80 uppercase tracking-wider">
            {status}
          </span>
        )}
        {phase && (
          <span className="font-ui text-[9px] text-cream/40">
            {phase}
          </span>
        )}
      </div>

      <h3 id={`trial-title-${idx}`} className="font-ui text-sm font-medium text-cream/80 group-hover:text-gold-h transition-colors mb-2 leading-snug">
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

      {enrollment != null && enrollment > 0 && (
        <p className="font-ui text-[10px] text-cream/30 mt-2">
          {enrollment} participants
        </p>
      )}

      <div className="flex items-center gap-4 mt-3 flex-wrap">
        <span className="font-ui text-[10px] text-cream/20">
          {result.source}
        </span>
        <Link
          href={`/?q=${encodeURIComponent(`Explain: ${result.title} — focus on trial design and outcomes.`)}&domain=${currentDomain}`}
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
