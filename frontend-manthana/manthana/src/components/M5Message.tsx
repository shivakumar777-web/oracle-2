"use client";

import React, { useState } from "react";
import Logo from "./Logo";
import type { M5DomainAnswer, M5Summary } from "@/lib/api";

interface M5MessageProps {
  query: string;
  answers: M5DomainAnswer[];
  summary?: M5Summary;
  isStreaming?: boolean;
}

const DOMAIN_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  allopathy: {
    bg: "bg-blue-500/[0.08]",
    border: "border-blue-500/30",
    text: "text-blue-300",
    accent: "bg-blue-500",
  },
  ayurveda: {
    bg: "bg-[#C8922A]/[0.08]",
    border: "border-[#C8922A]/30",
    text: "text-[#ECC967]",
    accent: "bg-[#C8922A]",
  },
  homeopathy: {
    bg: "bg-teal/[0.08]",
    border: "border-teal/30",
    text: "text-teal-h",
    accent: "bg-teal",
  },
  siddha: {
    bg: "bg-orange-500/[0.08]",
    border: "border-orange-500/30",
    text: "text-orange-300",
    accent: "bg-orange-500",
  },
  unani: {
    bg: "bg-purple-500/[0.08]",
    border: "border-purple-500/30",
    text: "text-purple-300",
    accent: "bg-purple-500",
  },
};

const DEFAULT_COLORS = {
  bg: "bg-white/[0.04]",
  border: "border-white/10",
  text: "text-cream/70",
  accent: "bg-gold",
};

function DomainCard({
  answer,
  isActive,
  onClick,
}: {
  answer: M5DomainAnswer;
  isActive: boolean;
  onClick: () => void;
}) {
  const colors = DOMAIN_COLORS[answer.domain] || DEFAULT_COLORS;
  const [showSources, setShowSources] = useState(false);

  return (
    <div
      className={`rounded-xl border transition-all duration-300 overflow-hidden ${
        isActive ? `${colors.bg} ${colors.border} ring-1 ${colors.text.replace("text-", "ring-")}` : "bg-white/[0.02] border-white/[0.06]"
      }`}
    >
      {/* Header */}
      <button
        onClick={onClick}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-xl">{answer.icon}</span>
        <div className="flex-1 text-left">
          <div className={`font-ui text-xs tracking-wider uppercase ${isActive ? colors.text : "text-cream/60"}`}>
            {answer.domain_name}
          </div>
          <div className="text-[10px] text-cream/40">{answer.tagline}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
            {answer.confidence}%
          </span>
          <svg
            className={`w-4 h-4 text-cream/40 transition-transform ${isActive ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isActive && (
        <div className="px-4 pb-4 border-t border-white/[0.06]">
          {/* Key Concepts */}
          {answer.key_concepts.length > 0 && (
            <div className="py-3 flex flex-wrap gap-1.5">
              {answer.key_concepts.map((concept: string, i: number) => (
                <span
                  key={i}
                  className={`text-[9px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}
                >
                  {concept}
                </span>
              ))}
            </div>
          )}

          {/* Main Content */}
          <div className="font-body text-sm text-cream/75 leading-[1.75] py-2">
            {answer.content}
          </div>

          {/* Treatment Approach */}
          {answer.treatment_approach && (
            <div className="mt-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">Approach</div>
              <div className="text-xs text-cream/70">{answer.treatment_approach}</div>
            </div>
          )}

          {/* Evidence Level */}
          {answer.evidence_level && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-cream/40">Evidence:</span>
              <span className={`text-[10px] ${colors.text}`}>{answer.evidence_level}</span>
            </div>
          )}

          {/* Sources Toggle */}
          {answer.sources.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowSources(!showSources)}
                className="text-[10px] text-cream/50 hover:text-cream/70 flex items-center gap-1 transition-colors"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${showSources ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {answer.sources.length} Sources
              </button>

              {showSources && (
                <div className="mt-2 space-y-1.5">
                  {answer.sources.slice(0, 4).map((src: { title: string; url: string; _source?: string; trustScore?: number }, i: number) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] transition-colors group"
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${colors.accent}/20 ${colors.text} text-[10px] font-bold`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-cream/80 truncate group-hover:text-cream">{src.title}</div>
                        <div className="text-[9px] text-cream/40 truncate">{src._source || src.url}</div>
                      </div>
                      {(src.trustScore ?? 0) > 0 && (
                        <span className="text-[9px] text-cream/50">{src.trustScore ?? 0}+</span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function M5Message({ query, answers, summary, isStreaming }: M5MessageProps) {
  const [activeDomain, setActiveDomain] = useState<string | null>(
    answers.length > 0 ? answers[0].domain : null
  );

  // Sort answers: Allopathy first, then the rest in standard order
  const sortedAnswers = [...answers].sort((a, b) => {
    if (a.domain === "allopathy") return -1;
    if (b.domain === "allopathy") return 1;
    return 0;
  });

  return (
    <div className="px-4 py-4">
      {/* M5 Header */}
      <div className="flex items-center gap-3 mb-4">
        <Logo size="nav" animate={false} />
        <span className="font-ui text-xs tracking-[0.15em] uppercase text-gold-h">
          M5 — Five Domains
        </span>
        <span className="font-ui text-[9px] px-2 py-0.5 rounded-full border border-gold/40 text-gold/80 uppercase tracking-wider">
          Integrative
        </span>
        {isStreaming && (
          <span className="ml-auto text-[10px] text-cream/40 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            Consulting all systems...
          </span>
        )}
      </div>

      {/* Query Display */}
      <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border-l-2 border-gold/50">
        <div className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">Your Question</div>
        <div className="font-body text-sm text-cream/80">{query}</div>
      </div>

      {/* Domain Tabs - Horizontal scroll on mobile */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
        {sortedAnswers.map((answer) => {
          const colors = DOMAIN_COLORS[answer.domain] || DEFAULT_COLORS;
          const isActive = activeDomain === answer.domain;
          return (
            <button
              key={answer.domain}
              onClick={() => setActiveDomain(answer.domain)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                isActive
                  ? `${colors.bg} ${colors.border} ${colors.text}`
                  : "bg-white/[0.02] border-white/[0.06] text-cream/50 hover:text-cream/70"
              }`}
            >
              <span>{answer.icon}</span>
              <span className="font-ui text-[10px] tracking-wider uppercase">{answer.domain_name}</span>
            </button>
          );
        })}
      </div>

      {/* Active Domain Detail View */}
      {activeDomain && (
        <div className="mb-4">
          {sortedAnswers
            .filter((a) => a.domain === activeDomain)
            .map((answer) => (
              <DomainCard
                key={answer.domain}
                answer={answer}
                isActive={true}
                onClick={() => {}}
              />
            ))}
        </div>
      )}

      {/* All Domains Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {sortedAnswers.map((answer) => (
          <DomainCard
            key={answer.domain}
            answer={answer}
            isActive={activeDomain === answer.domain}
            onClick={() => setActiveDomain(answer.domain === activeDomain ? null : answer.domain)}
          />
        ))}
      </div>

      {/* Integrative Summary */}
      {summary && summary.content && (
        <div className="mt-6 pt-4 border-t border-gold/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-gold" />
            <span className="font-ui text-xs tracking-wider uppercase text-gold/80">
              Integrative Insights
            </span>
          </div>
          <div className="font-body text-sm text-cream/70 leading-[1.75] p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            {summary.content}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 pt-4 border-t border-teal/30">
        <p className="text-xs italic text-teal/70">
          ⚕️ M5 mode presents perspectives from all five medical systems for educational comparison. 
          These systems have different theoretical foundations and should not be combined without 
          guidance from qualified practitioners in each system.
        </p>
      </div>
    </div>
  );
}
