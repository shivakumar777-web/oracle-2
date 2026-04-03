"use client";

import React, { useEffect, useState } from "react";

type SessionMode = "auto" | "search" | "deep-research" | "analysis" | string;

interface SessionRecord {
  id: string;
  timestamp: string;
  domain: string;
  mode: SessionMode;
  messages: { id: string; role: string; content: string }[];
}

interface HistoryItem {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  domains: string[];
  mode: SessionMode;
}

const DOMAIN_COLORS: Record<string, string> = {
  ayurveda: "text-gold/60",
  allopathy: "text-blue-400/60",
  research: "text-purple-400/60",
  drug: "text-emerald-400/60",
};

interface SegmentedHistory {
  oracle: HistoryItem[];
  search: HistoryItem[];
  deep: HistoryItem[];
}

interface ChatHistoryProps {
  onClose: () => void;
  onSelect?: (id: string) => void;
}

export default function ChatHistory({ onClose, onSelect }: ChatHistoryProps) {
  const [search, setSearch] = useState("");
  const [segmented, setSegmented] = useState<SegmentedHistory>({
    oracle: [],
    search: [],
    deep: [],
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("manthana_sessions");
      const sessions: SessionRecord[] = raw ? JSON.parse(raw) : [];

      const buckets: SegmentedHistory = {
        oracle: [],
        search: [],
        deep: [],
      };

      const toHistoryItem = (s: SessionRecord): HistoryItem => {
        const ts = new Date(s.timestamp);
        const formatted =
          Number.isNaN(ts.getTime()) ? s.timestamp : ts.toLocaleString();

        let lastUser: string | undefined;
        let lastAssistant: string | undefined;
        for (let i = s.messages.length - 1; i >= 0; i -= 1) {
          const m = s.messages[i];
          if (!lastAssistant && m.role === "assistant") {
            lastAssistant = m.content;
          }
          if (!lastUser && m.role === "user") {
            lastUser = m.content;
          }
          if (lastUser && lastAssistant) break;
        }

        const titleSource = lastUser || lastAssistant || "Untitled session";
        const previewSource = lastAssistant || lastUser || "";

        return {
          id: s.id,
          mode: s.mode,
          domains: [s.domain],
          timestamp: formatted,
          title:
            titleSource.length > 120
              ? `${titleSource.slice(0, 117)}...`
              : titleSource,
          preview:
            previewSource.length > 160
              ? `${previewSource.slice(0, 157)}...`
              : previewSource,
        };
      };

      sessions.forEach((s) => {
        const item = toHistoryItem(s);
        if (s.mode === "search") {
          buckets.search.push(item);
        } else if (s.mode === "deep-research") {
          buckets.deep.push(item);
        } else {
          /* Oracle + legacy analysis sessions */
          buckets.oracle.push(item);
        }
      });

      setSegmented(buckets);
    } catch {
      // ignore malformed storage
    }
  }, []);

  const filterItems = (items: HistoryItem[]) => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (h) =>
        h.title.toLowerCase().includes(q) ||
        h.preview.toLowerCase().includes(q)
    );
  };

  const oracleItems = filterItems(segmented.oracle);
  const searchItems = filterItems(segmented.search);
  const deepItems = filterItems(segmented.deep);

  const handleClearAll = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("manthana_sessions");
    setSegmented({ oracle: [], search: [], deep: [] });
  };

  const renderSection = (label: string, items: HistoryItem[]) => {
    if (items.length === 0) return null;
    return (
      <div className="px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-ui text-[9px] tracking-[0.3em] uppercase text-cream/35">
            {label}
          </h3>
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative px-0 py-2.5 hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/[0.02] last:border-b-0"
            onClick={() => onSelect?.(item.id)}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {item.domains.map((d) => (
                <span
                  key={d}
                  className={`font-ui text-[8px] uppercase tracking-wider ${
                    DOMAIN_COLORS[d] ?? "text-cream/30"
                  }`}
                >
                  {d}
                </span>
              ))}
              <span className="ml-auto font-ui text-[9px] text-cream/15">
                {item.timestamp}
              </span>
            </div>
            <h4 className="font-ui text-xs text-cream/65 mb-1 group-hover:text-cream/80 transition-colors line-clamp-1">
              {item.title}
            </h4>
            {item.preview && (
              <p className="font-body text-[11px] text-cream/25 italic line-clamp-1">
                {item.preview}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — slides from left */}
      <div className="relative w-full max-w-sm h-full bg-[#04080F]/96 border-r border-gold/10 flex flex-col animate-fi">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="font-ui text-xs tracking-[0.5em] uppercase text-cream/40">History</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full glass flex items-center justify-center text-cream/40 hover:text-cream/80 transition-colors text-sm">✕</button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history…"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5
              font-body text-xs text-cream/70 placeholder:text-cream/20 outline-none
              focus:border-gold/25 transition-colors"
          />
        </div>

        {/* Segmented history list */}
        <div className="flex-1 overflow-y-auto py-2 no-scrollbar space-y-2">
          {oracleItems.length === 0 &&
          searchItems.length === 0 &&
          deepItems.length === 0 ? (
            <p className="font-body text-xs italic text-cream/20 text-center mt-8">
              No history found yet.
            </p>
          ) : (
            <>
              {renderSection("Manthana Oracle History", oracleItems)}
              {renderSection("Manthana Web Search History", searchItems)}
              {renderSection("Manthana Deep Research History", deepItems)}
            </>
          )}
        </div>

        {/* Footer — Clear All */}
        <div className="px-4 py-4 border-t border-white/[0.04]">
          <button
            className="w-full font-ui text-[9px] tracking-[0.3em] uppercase text-red-400/40
            hover:text-red-400/70 transition-colors py-2"
            onClick={handleClearAll}
          >
            Clear All History
          </button>
        </div>
      </div>
    </div>
  );
}
