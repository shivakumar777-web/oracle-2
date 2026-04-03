"use client";

import React from "react";
import Link from "next/link";
import type { SearchResult } from "@/lib/api";
import { toViewerHref } from "@/lib/viewer-url";

interface FeaturedResultProps {
  result: SearchResult;
  currentDomain: string;
  onRecordClick?: (result: SearchResult, idx: number) => void;
  isSelected?: boolean;
}

/** Featured result card — highest-trust result displayed prominently (no AI, just best search result) */
export function FeaturedResult({
  result,
  currentDomain,
  onRecordClick,
  isSelected = false,
}: FeaturedResultProps) {
  const trustScore = result.trustScore ?? 0;
  const viewerHref = result.url ? toViewerHref(result.url) : null;

  return (
    <article
      role="article"
      className={`glass rounded-xl p-6 border-2 border-gold/30 bg-gradient-to-b from-gold/5 to-transparent
        hover:border-gold/50 hover:scale-[1.005] transition-all duration-200 group ${
        isSelected ? "ring-2 ring-gold/50 ring-offset-2 ring-offset-[#020618]" : ""
      }`}
      aria-labelledby="featured-result-title"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono tracking-widest uppercase text-gold-h">
          ⭐ Featured Result
        </span>
        <span className="font-ui text-[10px] text-cream/25 uppercase tracking-wider">
          {result.domain ?? result.source ?? ""}
        </span>
        {result.isPeerReviewed && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
            ✓ Peer Reviewed
          </span>
        )}
        {result.isOpenAccess && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
            🔓 Open Access
          </span>
        )}
      </div>

      <h2
        id="featured-result-title"
        className="font-ui text-base font-semibold text-cream/90 group-hover:text-gold-h transition-colors mb-2 leading-snug"
      >
        {result.url ? (
          viewerHref ? (
            <Link
              href={viewerHref}
              onClick={() => onRecordClick?.(result, 0)}
              className="hover:text-gold-h"
            >
              {result.title}
            </Link>
          ) : (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onRecordClick?.(result, 0)}
              className="hover:text-gold-h"
            >
              {result.title}
            </a>
          )
        ) : (
          result.title
        )}
      </h2>

      <p className="font-body text-sm text-cream/50 leading-relaxed line-clamp-3 mb-4">
        {result.snippet}
      </p>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-ui text-[10px] text-cream/30">
            {result.publishedDate ?? ""}
          </span>
          {trustScore > 0 && (
            <>
              <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-s to-gold-h rounded-full transition-all"
                  style={{ width: `${trustScore}%` }}
                />
              </div>
              <span className="font-ui text-[10px] text-gold/70 font-medium">
                {trustScore}% trust
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              const { copyCitation } = await import("@/lib/citation-generator");
              await copyCitation(result);
            }}
            className="font-ui text-[10px] text-cream/40 hover:text-gold-h transition-colors"
          >
            📋 Copy Citation
          </button>
          <Link
            href={`/?q=${encodeURIComponent(`Explain: ${result.title} — focus on key findings and clinical implications.`)}&domain=${currentDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-ui text-[10px] text-teal-h underline underline-offset-2 decoration-teal/60 hover:text-teal-p"
          >
            Ask Oracle →
          </Link>
        </div>
      </div>
    </article>
  );
}
