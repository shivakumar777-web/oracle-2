"use client";

import React, { useEffect, useState } from "react";
import { getSearchHistory } from "@/lib/api";

interface SearchHistoryItem {
  query: string;
  category: string;
  timestamp: string | null;
}

interface SearchHistoryProps {
  onSelect?: (query: string) => void;
  maxItems?: number;
}

export function SearchHistory({ onSelect, maxItems = 15 }: SearchHistoryProps) {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSearchHistory(maxItems)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [maxItems]);

  if (loading || history.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider">
        Recent searches
      </p>
      <div className="flex flex-wrap gap-1.5">
        {history.map((item, i) => (
          <button
            key={`${item.query}-${i}`}
            type="button"
            onClick={() => onSelect?.(item.query)}
            className="pill text-[9px] text-cream/60 hover:text-cream/90 hover:bg-white/5 transition-colors"
          >
            {item.query}
          </button>
        ))}
      </div>
    </div>
  );
}
