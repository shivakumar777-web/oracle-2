"use client";

import React, { useEffect, useState } from "react";
import { getTrending } from "@/lib/api";

interface TrendingSearchesProps {
  onSelect?: (query: string) => void;
  timeframe?: "hour" | "day" | "week";
  maxItems?: number;
}

export function TrendingSearches({
  onSelect,
  timeframe = "day",
  maxItems = 10,
}: TrendingSearchesProps) {
  const [queries, setQueries] = useState<{ query: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTrending(timeframe)
      .then((data) => {
        if (!cancelled) setQueries(data.slice(0, maxItems));
      })
      .catch(() => {
        if (!cancelled) setQueries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [timeframe, maxItems]);

  if (loading || queries.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="font-ui text-[9px] text-cream/25 uppercase tracking-wider">
        Trending searches
      </p>
      <div className="flex flex-wrap gap-1.5">
        {queries.map(({ query }) => (
          <button
            key={query}
            type="button"
            onClick={() => onSelect?.(query)}
            className="pill pill-teal text-[9px] hover:bg-teal/20 transition-colors"
          >
            {query}
          </button>
        ))}
      </div>
    </div>
  );
}
