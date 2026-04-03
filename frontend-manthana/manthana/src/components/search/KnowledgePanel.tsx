"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSnomedLookup } from "@/lib/api";
import type { SnomedConcept } from "@/types/clinical-tools";
import { fetchKnowledgeSummary } from "@/lib/api/web";
import { AYURVEDA_MAP } from "@/lib/ayurveda-map";

interface GuidelineItem {
  title: string;
  url: string;
  source?: string;
}

interface TrialItem {
  title: string;
  url: string;
  snippet?: string;
}

interface KnowledgePanelProps {
  entityName: string;
  domain: string;
  query?: string;
  relatedQuestions: string[];
  onRelatedClick?: (q: string) => void;
  guidelines?: GuidelineItem[];
  trials?: TrialItem[];
}

export function KnowledgePanel({
  entityName,
  domain,
  query,
  relatedQuestions,
  onRelatedClick,
  guidelines = [],
  trials = [],
}: KnowledgePanelProps) {
  const [snomedConcepts, setSnomedConcepts] = useState<SnomedConcept[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!entityName.trim()) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const concepts = await fetchSnomedLookup(entityName.trim());
        if (!cancelled) setSnomedConcepts(concepts);
      } catch {
        // SNOMED lookup is best-effort
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [entityName]);

  useEffect(() => {
    if (!entityName.trim()) { setAiSummary(null); return; }
    let cancelled = false;
    setSummaryLoading(true);
    const t = setTimeout(async () => {
      try {
        const result = await fetchKnowledgeSummary(entityName.trim(), domain);
        if (!cancelled) setAiSummary(result?.summary ?? null);
      } catch {
        // AI summary is best-effort
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [entityName, domain]);

  // Check if entity has Ayurvedic properties
  const ayurvedaKey = entityName.toLowerCase().replace(/\s+/g, "_");
  const ayurvedaInfo = (AYURVEDA_MAP as Record<string, any>)?.[ayurvedaKey];

  return (
    <div className="glass-gold rounded-xl p-5 sticky top-4 space-y-4">
      {/* Entity Title */}
      <h2 className="font-ui text-base font-semibold text-gold-h">
        {entityName.trim() || "Search for a medical topic"}
      </h2>

      {/* AI Summary */}
      {summaryLoading && (
        <div className="animate-pulse space-y-1.5">
          <div className="h-2 bg-cream/10 rounded w-full" />
          <div className="h-2 bg-cream/10 rounded w-4/5" />
          <div className="h-2 bg-cream/10 rounded w-3/5" />
        </div>
      )}
      {!summaryLoading && aiSummary && (
        <div>
          <p className="font-body text-[11px] text-cream/70 leading-relaxed">
            {aiSummary}
          </p>
          <p className="font-ui text-[8px] text-cream/20 mt-1">AI-generated summary</p>
        </div>
      )}

      {/* SNOMED Codes */}
      {snomedConcepts.length > 0 && (
        <div>
          <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider mb-1.5">
            SNOMED-CT
          </p>
          <div className="space-y-1">
            {snomedConcepts.slice(0, 3).map((c) => (
              <div
                key={c.conceptId}
                className="flex items-center gap-2 text-[11px]"
              >
                <span className="font-mono text-[10px] text-cream/50">
                  {c.conceptId}
                </span>
                <span className="text-cream/70">{c.preferredTerm}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ayurvedic Properties */}
      {domain === "ayurveda" && ayurvedaInfo && (
        <div>
          <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider mb-2">
            AYURVEDIC PROPERTIES
          </p>
          <div className="grid grid-cols-2 gap-3">
            {ayurvedaInfo.rasa && (
              <div>
                <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider mb-0.5">Rasa</p>
                <p className="font-body text-xs text-cream/70">{ayurvedaInfo.rasa}</p>
              </div>
            )}
            {ayurvedaInfo.guna && (
              <div>
                <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider mb-0.5">Guna</p>
                <p className="font-body text-xs text-cream/70">{ayurvedaInfo.guna}</p>
              </div>
            )}
            {ayurvedaInfo.dosage && (
              <div>
                <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider mb-0.5">Dosage</p>
                <p className="font-body text-xs text-cream/70">{ayurvedaInfo.dosage}</p>
              </div>
            )}
            {ayurvedaInfo.dosha && (
              <div>
                <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider mb-0.5">Dosha</p>
                <p className="font-body text-xs text-cream/70">{ayurvedaInfo.dosha}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Related Guidelines */}
      {guidelines.length > 0 && (
        <div>
          <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider mb-2">
            CLINICAL GUIDELINES
          </p>
          <div className="space-y-1.5">
            {guidelines.slice(0, 3).map((g, i) => (
              <a
                key={g.url ?? i}
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[11px] text-teal-h hover:text-teal-p"
              >
                📋 {g.title}
                {g.source && <span className="text-cream/40"> ({g.source})</span>}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Active Trials */}
      {trials.length > 0 && (
        <div>
          <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider mb-2">
            RELATED TRIALS
          </p>
          <div className="space-y-1.5">
            {trials.slice(0, 3).map((t, i) => (
              <a
                key={t.url ?? i}
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[11px] text-teal-h hover:text-teal-p"
              >
                🧪 {t.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Related Searches */}
      {relatedQuestions.length > 0 && (
        <div>
          <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider mb-2">
            RELATED SEARCHES
          </p>
          <div className="flex flex-wrap gap-1.5">
            {relatedQuestions.slice(0, 5).map((q) => (
              <button
                type="button"
                key={q}
                className="pill pill-teal text-[9px]"
                onClick={() => onRelatedClick?.(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cross-domain bridge */}
      {query && query.trim().length > 0 && (
        <div className="pt-2 border-t border-gold/10">
          <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider mb-1.5">
            Cross-domain
          </p>
          {domain === "ayurveda" ? (
            <Link
              href={`/search?q=${encodeURIComponent(query.trim())}&tab=all&domain=allopathy`}
              className="text-[11px] text-teal-h hover:text-teal-p underline underline-offset-2"
            >
              See Allopathic perspective →
            </Link>
          ) : (
            <Link
              href={`/search?q=${encodeURIComponent(query.trim())}&tab=all&domain=ayurveda`}
              className="text-[11px] text-teal-h hover:text-teal-p underline underline-offset-2"
            >
              See Ayurvedic perspective →
            </Link>
          )}
        </div>
      )}

      {/* Domain Badge */}
      <div className="pt-2 border-t border-gold/10">
        <span className="font-ui text-[8px] tracking-[0.3em] uppercase text-cream/20">
          {domain === "ayurveda"
            ? "Source: Ayurvedic Pharmacopoeia of India"
            : "Source: Medical Knowledge Graph"}
        </span>
      </div>
    </div>
  );
}
