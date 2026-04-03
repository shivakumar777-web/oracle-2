"use client";

import React, { useEffect, useState } from "react";
import type { ICD10Suggestion } from "@/types/clinical-tools";
import { suggestICD10 } from "@/lib/api";

interface ICD10ChipProps {
  term: string;
}

export default function ICD10Chip({ term }: ICD10ChipProps) {
  const [suggestion, setSuggestion] = useState<ICD10Suggestion | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await suggestICD10(term);
        if (!cancelled && res && res.length > 0) {
          setSuggestion(res[0]);
        }
      } catch {
        // silent fail; chip still clickable
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [term]);

  const handleClick = () => {
    if (typeof window !== "undefined") {
      (window as any).openClinicalTools?.("icd10", {
        query: term,
      });
    }
  };

  const label = suggestion
    ? `ICD-10: ${suggestion.code}`
    : "ICD-10 lookup";

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-baseline gap-1 border-b border-dotted border-amber-400/60 text-amber-200/90 hover:text-amber-100 transition-colors"
      title={label}
    >
      <span>{term}</span>
      {suggestion && (
        <span className="font-ui text-[10px] text-amber-300/90 ml-0.5">
          [{suggestion.code}]
        </span>
      )}
    </button>
  );
}

