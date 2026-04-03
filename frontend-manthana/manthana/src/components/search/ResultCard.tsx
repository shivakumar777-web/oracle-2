"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { SearchResult } from "@/lib/api";
import { copyCitation } from "@/lib/citation-generator";
import { getEvidenceLevel, getEvidenceBadge } from "@/lib/search-evidence";
import { toViewerHref } from "@/lib/viewer-url";

interface ResultCardProps {
  result: SearchResult;
  query: string;
  index: number;
}

function highlightQuery(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const words = query
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const regex = new RegExp(`(${words.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="bg-transparent text-[#C8922A] font-medium"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function getTrustColor(score: number): string {
  if (score >= 90) return "#22C55E";
  if (score >= 70) return "#C8922A";
  if (score >= 50) return "#6B7280";
  return "#374151";
}

function getFavicon(domain: string): string {
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
}

function truncateUrl(url: string, maxLen = 60): string {
  try {
    const u = new URL(url);
    const combined = u.hostname + u.pathname;
    return combined.length > maxLen
      ? combined.substring(0, maxLen) + "…"
      : combined;
  } catch {
    return url.substring(0, maxLen);
  }
}

export default function ResultCard({ result, query, index }: ResultCardProps) {
  const [copied, setCopied] = useState(false);
  const trustColor = getTrustColor(result.trustScore);
  const viewerHref = toViewerHref(result.url);

  const handleCite = async (e: React.MouseEvent) => {
    e.preventDefault();
    await copyCitation(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article
      className="relative group rounded-lg bg-[#0D1B3E]/60 border border-white/[0.06]
        hover:border-white/[0.12] transition-all duration-200 overflow-hidden"
      style={{ borderLeft: `3px solid ${trustColor}` }}
    >
      <div className="px-4 py-3">
        {/* Top row — source, badges, date */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          {result.domain && (
            <img
              src={getFavicon(result.domain)}
              alt=""
              width={14}
              height={14}
              className="rounded-sm opacity-70"
              onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
            />
          )}
          <span className="text-[10px] text-cream/50 font-mono">{result.source}</span>

          {result.isPeerReviewed && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#22C55E]/10
              text-[#22C55E] border border-[#22C55E]/20 font-medium">
              ✓ Peer Reviewed
            </span>
          )}
          {result.isOfficial && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#3B82F6]/10
              text-[#3B82F6] border border-[#3B82F6]/20 font-medium">
              🏛 Official
            </span>
          )}
          {result.isOpenAccess && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10
              text-[#F59E0B] border border-[#F59E0B]/20 font-medium">
              🔓 Open Access
            </span>
          )}
          {result.type === "trial" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10
              text-purple-400 border border-purple-500/20 font-medium">
              🧪 Clinical Trial
            </span>
          )}
          {result.type === "guideline" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10
              text-cyan-400 border border-cyan-500/20 font-medium">
              📋 Guideline
            </span>
          )}
          {result.sourceBadge && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10
              text-amber-300 border border-amber-500/25 font-medium">
              {result.sourceBadge}
            </span>
          )}
          {result.paperFallback && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-500/15
              text-zinc-300 border border-zinc-500/25 font-medium" title="Broad web fallback">
              Web fallback
            </span>
          )}
          {result.guidelineFallback && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10
              text-cyan-200 border border-cyan-500/30 font-medium" title="Broadened search">
              Broad match
            </span>
          )}
          {result.trialsFallback && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10
              text-purple-300 border border-purple-500/25 font-medium" title="Web supplement">
              Web supplement
            </span>
          )}
          {result.type === "pdf" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10
              text-red-400 border border-red-500/20 font-medium">
              📄 PDF
            </span>
          )}
          {(() => {
            const badge = getEvidenceBadge(getEvidenceLevel(result));
            return badge ? (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${badge.className}`}>
                {badge.label}
              </span>
            ) : null;
          })()}

          {result.publishedDate && (
            <span className="text-[9px] text-cream/30 ml-auto">
              {new Date(result.publishedDate).getFullYear()}
            </span>
          )}
        </div>

        {/* Title — open inside Manthana /viewer when possible (feels native vs jumping to Chrome/Google) */}
        {viewerHref ? (
          <Link
            href={viewerHref}
            className="block font-display text-[15px] text-cream/90 leading-snug mb-1
              hover:text-[#C8922A] transition-colors group-hover:underline
              decoration-[#C8922A]/40 underline-offset-2"
          >
            {result.title}
          </Link>
        ) : (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-display text-[15px] text-cream/90 leading-snug mb-1
              hover:text-[#C8922A] transition-colors group-hover:underline
              decoration-[#C8922A]/40 underline-offset-2"
          >
            {result.title}
          </a>
        )}

        {/* Snippet */}
        {result.snippet && (
          <p className="text-[12px] text-cream/55 leading-relaxed line-clamp-3 mb-2">
            {highlightQuery(result.snippet, query)}
          </p>
        )}

        {/* Bottom row — URL + actions */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[10px] text-cream/25 font-mono truncate max-w-[60%]">
            {truncateUrl(result.url)}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0 opacity-0
            group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCite}
              title="Copy Vancouver citation"
              className="flex items-center gap-1 text-[10px] text-cream/40
                hover:text-[#C8922A] transition-colors"
            >
              {copied ? (
                <span className="text-[#22C55E]">✓ Copied</span>
              ) : (
                <>📋 <span>Cite</span></>
              )}
            </button>
            {viewerHref ? (
              <Link
                href={viewerHref}
                className="text-[10px] text-cream/40 hover:text-[#C8922A] transition-colors"
              >
                ↗ Open
              </Link>
            ) : (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-cream/40 hover:text-[#C8922A] transition-colors"
              >
                ↗ Open
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
