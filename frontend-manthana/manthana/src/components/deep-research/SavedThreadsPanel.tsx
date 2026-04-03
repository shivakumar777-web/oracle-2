"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import {
  deleteResearchThread,
  listResearchThreads,
  type ResearchThread,
} from "@/lib/api";

interface Props {
  onRestoreThread: (thread: ResearchThread) => void;
}

/**
 * Lists threads from GET /v1/research/threads (same origin as Save ☁).
 * Anonymous users get an empty list from the API.
 */
export function SavedThreadsPanel({ onRestoreThread }: Props) {
  const [threads, setThreads] = useState<ResearchThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const list = await listResearchThreads(40);
      setThreads(list);
    } catch (e) {
      setThreads([]);
      setLoadError(
        e instanceof Error ? e.message : "Could not load saved research.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdated = () => {
      void refresh();
    };
    window.addEventListener("deep-research-threads-updated", onUpdated);
    return () =>
      window.removeEventListener("deep-research-threads-updated", onUpdated);
  }, [refresh]);

  const handleDelete = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Remove this saved research from your account?")) {
      return;
    }
    try {
      await deleteResearchThread(id);
      setThreads((prev) => prev.filter((t) => t.id !== id));
    } catch {
      window.alert("Could not delete. Try again.");
    }
  };

  if (loading && threads.length === 0) {
    return (
      <section className="saved-threads saved-threads--loading">
        <div className="saved-threads-title">Saved to account</div>
        <p className="saved-threads-hint">Loading…</p>
        <style jsx>{`
          .saved-threads {
            margin-top: 1rem;
            padding: 0.75rem;
            border-radius: 10px;
            border: 1px solid rgba(34, 197, 94, 0.22);
            background: rgba(34, 197, 94, 0.04);
          }
          .saved-threads-title {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: rgba(167, 243, 208, 0.75);
          }
          .saved-threads-hint {
            font-size: 0.72rem;
            color: rgba(245, 239, 232, 0.42);
            margin: 0.35rem 0 0;
          }
        `}</style>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="saved-threads saved-threads--error">
        <div className="saved-threads-title">Saved to account</div>
        <p className="saved-threads-hint">{loadError}</p>
        <style jsx>{`
          .saved-threads {
            margin-top: 1rem;
            padding: 0.75rem;
            border-radius: 10px;
            border: 1px solid rgba(248, 113, 113, 0.25);
            background: rgba(248, 113, 113, 0.05);
          }
          .saved-threads-title {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: rgba(254, 202, 202, 0.75);
          }
          .saved-threads-hint {
            font-size: 0.72rem;
            color: rgba(245, 239, 232, 0.5);
            margin: 0.35rem 0 0;
          }
        `}</style>
      </section>
    );
  }

  if (threads.length === 0) {
    return (
      <section className="saved-threads saved-threads--empty">
        <div className="saved-threads-title">Saved to account</div>
        <p className="saved-threads-hint">
          Use <strong>☁ Save</strong> on a result when signed in. Saved runs
          appear here on all your devices.
        </p>
        <style jsx>{`
          .saved-threads {
            margin-top: 1rem;
            padding: 0.75rem;
            border-radius: 10px;
            border: 1px solid rgba(34, 197, 94, 0.22);
            background: rgba(34, 197, 94, 0.04);
          }
          .saved-threads-title {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: rgba(167, 243, 208, 0.75);
          }
          .saved-threads-hint {
            font-size: 0.72rem;
            color: rgba(245, 239, 232, 0.42);
            margin: 0.35rem 0 0;
            line-height: 1.45;
          }
          .saved-threads-hint strong {
            color: rgba(167, 243, 208, 0.85);
            font-weight: 600;
          }
        `}</style>
      </section>
    );
  }

  return (
    <section className="saved-threads">
      <div className="saved-threads-header">
        <span className="saved-threads-title">Saved to account</span>
        <button
          type="button"
          className="saved-threads-refresh"
          onClick={() => void refresh()}
          title="Refresh list"
        >
          ↻
        </button>
      </div>
      <ul className="saved-threads-list" role="list">
        {threads.map((t) => (
          <li key={t.id} className="saved-threads-row">
            <button
              type="button"
              className="saved-threads-item"
              onClick={() => onRestoreThread(t)}
              title="Open saved result"
            >
              <span className="saved-threads-line1">
                {(t.title || t.query).length > 64
                  ? `${(t.title || t.query).slice(0, 61)}…`
                  : t.title || t.query}
              </span>
              <span className="saved-threads-line2">
                {new Date(t.updated_at || t.created_at).toLocaleString()}
              </span>
            </button>
            <button
              type="button"
              className="saved-threads-delete"
              aria-label="Delete saved research"
              onClick={(e) => void handleDelete(e, t.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <style jsx>{`
        .saved-threads {
          margin-top: 1rem;
          padding: 0.75rem;
          border-radius: 10px;
          border: 1px solid rgba(34, 197, 94, 0.22);
          background: rgba(34, 197, 94, 0.04);
        }
        .saved-threads-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .saved-threads-title {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(167, 243, 208, 0.75);
        }
        .saved-threads-refresh {
          font-size: 0.75rem;
          color: rgba(245, 239, 232, 0.5);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.15rem 0.35rem;
        }
        .saved-threads-refresh:hover {
          color: rgba(167, 243, 208, 0.95);
        }
        .saved-threads-list {
          list-style: none;
          margin: 0;
          padding: 0;
          max-height: 200px;
          overflow-y: auto;
        }
        .saved-threads-row {
          display: flex;
          align-items: stretch;
          gap: 0.25rem;
          border-radius: 6px;
        }
        .saved-threads-row:hover {
          background: rgba(34, 197, 94, 0.08);
        }
        .saved-threads-item {
          flex: 1;
          min-width: 0;
          text-align: left;
          padding: 0.45rem 0.35rem;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .saved-threads-line1 {
          font-size: 0.78rem;
          color: rgba(245, 239, 232, 0.88);
          line-height: 1.35;
        }
        .saved-threads-line2 {
          font-size: 0.62rem;
          color: rgba(245, 239, 232, 0.38);
        }
        .saved-threads-delete {
          flex-shrink: 0;
          align-self: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: rgba(248, 113, 113, 0.55);
          cursor: pointer;
          font-size: 0.75rem;
        }
        .saved-threads-delete:hover {
          background: rgba(248, 113, 113, 0.12);
          color: rgba(254, 202, 202, 0.95);
        }
      `}</style>
    </section>
  );
}
