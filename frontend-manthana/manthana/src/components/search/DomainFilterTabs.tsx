"use client";

import React from "react";
import type { SearchResult } from "@/lib/api";

export type FilterTab =
  | "all"
  | "pubmed"
  | "guidelines"
  | "trials"
  | "ayurveda"
  | "homeopathy"
  | "siddha"
  | "unani";

const TABS: { id: FilterTab; label: string; count?: number }[] = [
  { id: "all", label: "All Medical" },
  { id: "pubmed", label: "PubMed" },
  { id: "guidelines", label: "Guidelines" },
  { id: "trials", label: "Trials" },
  { id: "ayurveda", label: "Ayurveda" },
  { id: "homeopathy", label: "Homeopathy" },
  { id: "siddha", label: "Siddha" },
  { id: "unani", label: "Unani" },
];

const FILTER_MAP: Record<FilterTab, (r: SearchResult) => boolean> = {
  all: () => true,
  pubmed: (r) => r.domain?.includes("pubmed") || r.domain?.includes("ncbi"),
  guidelines: (r) =>
    r.type === "guideline" ||
    r.domain?.includes("who") ||
    r.domain?.includes("icmr") ||
    r.domain?.includes("nih"),
  trials: (r) =>
    r.type === "trial" ||
    r.domain?.includes("clinicaltrials") ||
    r.domain?.includes("ctri"),
  ayurveda: (r) =>
    ["ayush.gov.in", "ccras.nic.in", "niimh.nic.in", "nmpb.nic.in"].some(
      (d) => r.domain?.includes(d)
    ),
  homeopathy: (r) =>
    ["ccrh.gov.in", "similima"].some((d) => r.domain?.includes(d)),
  siddha: (r) => r.domain?.includes("ccsiddha"),
  unani: (r) => r.domain?.includes("ccrum"),
};

interface DomainFilterTabsProps {
  results: SearchResult[];
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
}

export function filterResults(
  results: SearchResult[],
  tab: FilterTab
): SearchResult[] {
  return results.filter(FILTER_MAP[tab] ?? (() => true));
}

export default function DomainFilterTabs({
  results,
  activeTab,
  onTabChange,
}: DomainFilterTabsProps) {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto pb-1 mb-4"
      style={{ scrollbarWidth: "none" }}
    >
      {TABS.map((tab) => {
        const count = filterResults(results, tab.id).length;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 text-[10px] px-3 py-1.5
              rounded-full border transition-all duration-150 font-mono ${
              isActive
                ? "border-[#C8922A] text-[#C8922A] bg-[#C8922A]/10"
                : "border-white/10 text-cream/40 hover:border-white/20 hover:text-cream/60"
            }`}
          >
            {tab.label}
            {count > 0 && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? "bg-[#C8922A]/20 text-[#C8922A]"
                    : "bg-white/10 text-cream/30"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
