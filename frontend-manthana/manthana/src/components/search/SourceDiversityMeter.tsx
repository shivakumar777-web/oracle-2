"use client";

import React from "react";

interface SourceDiversityMeterProps {
  enginesUsed: string[];
  elapsed?: number;
  className?: string;
}

/** Shows which search engines/sources were queried */
export function SourceDiversityMeter({
  enginesUsed,
  elapsed,
  className = "",
}: SourceDiversityMeterProps) {
  if (!enginesUsed?.length) return null;

  const unique = Array.from(new Set(enginesUsed.map((e) => e.trim()).filter(Boolean)));
  if (unique.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 flex-wrap ${className}`}
      title={`Searched: ${unique.join(", ")}`}
    >
      <span className="font-ui text-[9px] text-cream/30 uppercase tracking-wider">
        Sources:
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {unique.slice(0, 6).map((engine) => (
          <span
            key={engine}
            className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-cream/50 font-mono"
          >
            {engine}
          </span>
        ))}
        {unique.length > 6 && (
          <span className="text-[9px] text-cream/30">+{unique.length - 6}</span>
        )}
      </div>
      {elapsed != null && elapsed > 0 && (
        <span className="font-ui text-[9px] text-cream/25 ml-1">
          ({elapsed}ms)
        </span>
      )}
    </div>
  );
}
