"use client";

import React, { useState } from "react";
import type { SearchResponse, SearchResult } from "@/lib/api";
import ResultCard from "@/components/search/ResultCard";
import ImageStrip from "@/components/search/ImageStrip";
import VideoStrip from "@/components/search/VideoStrip";
import RelatedQuestions from "@/components/search/RelatedQuestions";
import DomainFilterTabs, {
  filterResults,
  type FilterTab,
} from "@/components/search/DomainFilterTabs";

interface ManthanWebResultsProps {
  data: SearchResponse;
  query: string;
  domain: string;
  onRelatedClick: (q: string) => void;
  onPageChange?: (page: number) => void;
}

const PAGE_SIZE = 8;

function EmptyState({
  domain,
  onSwitchAll,
}: {
  domain: string;
  onSwitchAll: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center
        rounded-xl border border-white/[0.06] bg-[#0D1B3E]/40"
    >
      <span className="text-4xl mb-4">🔭</span>
      <h3 className="text-cream/70 text-base font-display mb-2">
        No results found in {domain}
      </h3>
      <p className="text-cream/35 text-sm mb-6 max-w-xs">
        Try broader search terms, different medical terminology, or switch to All
        Medical to search across all domains.
      </p>
      <ul className="text-left text-[12px] text-cream/40 space-y-1 mb-6">
        <li>• Use English medical terminology</li>
        <li>• Try the generic drug or herb name</li>
        <li>• Search by condition rather than symptom</li>
      </ul>
      <button
        onClick={onSwitchAll}
        className="px-4 py-2 rounded-full border border-[#C8922A]/40
          text-[#C8922A] text-sm hover:bg-[#C8922A]/10 transition-colors"
      >
        Switch to All Medical
      </button>
    </div>
  );
}

function MetaBar({
  data,
  currentPage,
  totalPages,
  onPageChange,
}: {
  data: SearchResponse;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const numResults =
    typeof data.total === "number" && data.total > 0
      ? data.total.toLocaleString()
      : data.results.length.toString();

  return (
    <div className="flex items-center justify-between mb-3 gap-2">
      <p className="text-[10px] text-cream/30 font-mono truncate">
        {numResults} results · {data.elapsed}s ·{" "}
        {data.enginesUsed.length > 0
          ? `via ${data.enginesUsed.slice(0, 4).join(" · ")}${
              data.enginesUsed.length > 4 ? ` +${data.enginesUsed.length - 4}` : ""
            }`
          : ""}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="text-[10px] text-cream/30 hover:text-cream/70 disabled:opacity-20
              px-1 transition-colors"
          >
            ←
          </button>
          <span className="text-[10px] text-cream/40 font-mono">
            {currentPage}/{totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="text-[10px] text-cream/30 hover:text-cream/70 disabled:opacity-20
              px-1 transition-colors"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

export default function ManthanWebResults({
  data,
  query,
  domain,
  onRelatedClick,
  onPageChange,
}: ManthanWebResultsProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showAll, setShowAll] = useState(false);
  const currentPage = data.page ?? 1;

  const filtered = filterResults(data.results, activeTab);
  const visibleResults = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const hiddenCount = filtered.length - PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil((data.total || data.results.length) / 10));

  const handlePageChange = (p: number) => {
    setShowAll(false);
    setActiveTab("all");
    onPageChange?.(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-16">
      {/* Meta bar */}
      <MetaBar
        data={data}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {/* Image strip */}
      <ImageStrip images={data.images ?? []} />

      {/* Domain filter tabs */}
      <DomainFilterTabs
        results={data.results}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setShowAll(false);
        }}
      />

      {/* Result cards or empty state */}
      {filtered.length === 0 ? (
        <EmptyState
          domain={domain}
          onSwitchAll={() => setActiveTab("all")}
        />
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {visibleResults.map((result, idx) => (
            <ResultCard
              key={result.url + idx}
              result={result}
              query={query}
              index={idx}
            />
          ))}

          {/* Show more */}
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-2.5 rounded-lg border border-white/[0.06]
                text-[11px] text-cream/40 hover:text-cream/70 hover:border-white/10
                transition-all font-mono"
            >
              Show {hiddenCount} more results
            </button>
          )}
        </div>
      )}

      {/* Local index results */}
      {data.localResults && data.localResults.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-cream/30 font-mono tracking-widest uppercase">
              📚 From Manthana Index
            </span>
            <span className="text-[9px] text-cream/20">
              Previously indexed &amp; verified content
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {data.localResults.map((result: SearchResult, idx: number) => (
              <div
                key={idx}
                className="rounded-lg bg-black/30 border border-white/[0.04] px-4 py-3"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#C8922A]/10
                    text-[#C8922A] border border-[#C8922A]/20 font-mono">
                    ✦ Manthana Indexed
                  </span>
                </div>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[14px] text-cream/85 hover:text-[#C8922A]
                    transition-colors mb-1"
                >
                  {result.title}
                </a>
                {result.snippet && (
                  <p className="text-[11px] text-cream/45 line-clamp-2">
                    {result.snippet}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related questions */}
      <RelatedQuestions
        questions={data.relatedQuestions ?? []}
        onQuestionClick={onRelatedClick}
      />

      {/* Video strip */}
      <VideoStrip videos={data.videos ?? []} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-6">
          <button
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className="px-3 py-1.5 rounded-md border border-white/[0.08] text-[11px]
              text-cream/40 hover:text-cream/70 hover:border-white/15
              disabled:opacity-20 transition-all font-mono"
          >
            ← Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`w-8 h-8 rounded-md text-[11px] font-mono transition-all
                  ${
                    p === currentPage
                      ? "bg-[#C8922A]/20 border border-[#C8922A]/50 text-[#C8922A]"
                      : "border border-white/[0.06] text-cream/35 hover:text-cream/70"
                  }`}
              >
                {p}
              </button>
            );
          })}
          <button
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className="px-3 py-1.5 rounded-md border border-white/[0.08] text-[11px]
              text-cream/40 hover:text-cream/70 hover:border-white/15
              disabled:opacity-20 transition-all font-mono"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
