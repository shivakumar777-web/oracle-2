"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeepResearchHistoryEntry } from "@/hooks/useDeepResearch";

const HISTORY_KEY = "manthana_deep_research_history";

interface Props {
  onRestoreSession: (entry: DeepResearchHistoryEntry) => void;
}

export function ResearchHistory({ onRestoreSession }: Props) {
  const [items, setItems] = useState<DeepResearchHistoryEntry[]>([]);

  const load = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === HISTORY_KEY) load();
    };
    const onUpdated = () => load();
    window.addEventListener("storage", onStorage);
    window.addEventListener("deep-research-history-updated", onUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("deep-research-history-updated", onUpdated);
    };
  }, [load]);

  const clear = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(HISTORY_KEY);
    setItems([]);
  }, []);

  if (items.length === 0) {
    return (
      <section className="research-history research-history--empty">
        <div className="research-history-title">Recent research</div>
        <p className="research-history-hint">
          Completed runs are saved locally (last 50).
        </p>
      </section>
    );
  }

  return (
    <section className="research-history">
      <div className="research-history-header">
        <span className="research-history-title">Recent research</span>
        <button
          type="button"
          className="research-history-clear"
          onClick={clear}
        >
          Clear
        </button>
      </div>
      <ul className="research-history-list" role="list">
        {items.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className="research-history-item"
              onClick={() => onRestoreSession(entry)}
            >
              <span className="research-history-query">
                {entry.query.length > 72
                  ? `${entry.query.slice(0, 69)}…`
                  : entry.query}
              </span>
              <span className="research-history-meta">
                {new Date(entry.timestamp).toLocaleString()} ·{" "}
                {entry.selectedDomains.join(", ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <style jsx>{`
        .research-history {
          margin-top: 1rem;
          padding: 0.75rem;
          border-radius: 10px;
          border: 1px solid rgba(124, 58, 237, 0.2);
          background: rgba(0, 0, 0, 0.2);
        }
        .research-history--empty {
          opacity: 0.75;
        }
        .research-history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .research-history-title {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(245, 239, 232, 0.55);
        }
        .research-history-clear {
          font-size: 0.65rem;
          color: rgba(245, 239, 232, 0.45);
          background: none;
          border: none;
          cursor: pointer;
        }
        .research-history-clear:hover {
          color: #c8922a;
        }
        .research-history-hint {
          font-size: 0.72rem;
          color: rgba(245, 239, 232, 0.4);
          margin: 0;
        }
        .research-history-list {
          list-style: none;
          margin: 0;
          padding: 0;
          max-height: 200px;
          overflow-y: auto;
        }
        .research-history-item {
          width: 100%;
          text-align: left;
          padding: 0.5rem 0.35rem;
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .research-history-item:hover {
          background: rgba(124, 58, 237, 0.12);
        }
        .research-history-query {
          font-size: 0.78rem;
          color: rgba(245, 239, 232, 0.88);
          line-height: 1.35;
        }
        .research-history-meta {
          font-size: 0.65rem;
          color: rgba(245, 239, 232, 0.4);
        }
      `}</style>
    </section>
  );
}
