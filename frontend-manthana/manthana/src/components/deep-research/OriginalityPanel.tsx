"use client";

import React, { useEffect, useState } from "react";
import type {
  PlagiarismResult,
  PlagiarismState,
  PlagiarismMatch,
} from "@/types/plagiarism";

interface OriginalityPanelProps {
  state: PlagiarismState;
  result: PlagiarismResult | null;
  onClose: () => void;
}

function scoreColor(score: number): string {
  if (score >= 85) return "#22C55E";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

function scoreLabel(score: number): string {
  if (score >= 85) return "High Originality";
  if (score >= 60) return "Review Suggested";
  return "Low Originality";
}

export function OriginalityPanel({
  state,
  result,
  onClose,
}: OriginalityPanelProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (state !== "checking") {
      setStep(0);
      return;
    }
    setStep(1);
    const t1 = setTimeout(() => setStep(2), 800);
    const t2 = setTimeout(() => setStep(3), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [state]);

  if (state === "idle") return null;

  if (state === "checking") {
    return (
      <div className="orig-panel">
        <div className="orig-header">
          <div className="spinner" aria-hidden="true" />
          <div>
            <div className="title">Checking Originality...</div>
            <div className="subtitle">
              Comparing against 99B+ web pages and indexed medical literature.
            </div>
          </div>
        </div>
        <div className="steps">
          <div className={`step-line ${step >= 1 ? "visible" : ""}`}>
            🔍 Extracting content fingerprints...
          </div>
          <div className={`step-line ${step >= 2 ? "visible" : ""}`}>
            🌐 Searching across web sources...
          </div>
          <div className={`step-line ${step >= 3 ? "visible" : ""}`}>
            🧠 Cross-referencing Qdrant medical database...
          </div>
        </div>
        <p className="footnote">
          This runs entirely on the Manthana stack — no external paid APIs.
        </p>
        <style jsx>{`
          .orig-panel {
            margin-top: 1rem;
            padding: 1rem 1.2rem;
            border-radius: 12px;
            border: 1px solid rgba(147, 197, 253, 0.35);
            background: radial-gradient(
                circle at 0 0,
                rgba(59, 130, 246, 0.22),
                transparent 55%
              ),
              rgba(15, 23, 42, 0.9);
          }
          .orig-header {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            margin-bottom: 0.75rem;
          }
          .spinner {
            width: 26px;
            height: 26px;
            border-radius: 999px;
            border: 3px solid rgba(191, 219, 254, 0.25);
            border-top-color: #a855f7;
            animation: spin 0.9s linear infinite;
          }
          .title {
            font-family: "Space Mono", monospace;
            font-size: 0.8rem;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #e5e7eb;
          }
          .subtitle {
            font-family: "Lora", serif;
            font-size: 0.78rem;
            color: rgba(209, 213, 219, 0.8);
            margin-top: 0.15rem;
          }
          .steps {
            margin-top: 0.5rem;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            font-family: "Lora", serif;
            font-size: 0.8rem;
            color: rgba(209, 213, 219, 0.88);
          }
          .step-line {
            opacity: 0;
            transform: translateY(4px);
            transition: opacity 0.25s ease, transform 0.25s ease;
          }
          .step-line.visible {
            opacity: 1;
            transform: translateY(0);
          }
          .footnote {
            margin-top: 0.7rem;
            font-family: "Space Mono", monospace;
            font-size: 0.65rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: rgba(148, 163, 184, 0.9);
          }
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="orig-panel error">
        <div className="error-header">
          <span className="error-icon">⚠</span>
          <div>
            <div className="title">Originality check unavailable</div>
            <div className="subtitle">
              Backend services (SearxNG / Qdrant) may be offline. Run
              docker-compose up to restore.
            </div>
          </div>
        </div>
        <button
          type="button"
          className="dismiss-btn"
          onClick={onClose}
          aria-label="Dismiss originality panel"
        >
          Dismiss
        </button>
        <style jsx>{`
          .orig-panel {
            margin-top: 1rem;
            padding: 0.9rem 1.1rem;
            border-radius: 10px;
            border: 1px solid rgba(248, 113, 113, 0.65);
            background: rgba(127, 29, 29, 0.2);
          }
          .error-header {
            display: flex;
            align-items: flex-start;
            gap: 0.6rem;
          }
          .error-icon {
            font-size: 1.1rem;
          }
          .title {
            font-family: "Space Mono", monospace;
            font-size: 0.78rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #fecaca;
          }
          .subtitle {
            font-family: "Lora", serif;
            font-size: 0.78rem;
            color: rgba(254, 226, 226, 0.8);
            margin-top: 0.15rem;
          }
          .dismiss-btn {
            margin-top: 0.6rem;
            font-family: "Space Mono", monospace;
            font-size: 0.7rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            background: transparent;
            border-radius: 999px;
            border: 1px solid rgba(254, 202, 202, 0.6);
            padding: 0.25rem 0.8rem;
            color: rgba(254, 226, 226, 0.9);
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  if (!result) return null;

  const score = result.originalityScore ?? 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset =
    circumference - (circumference * clampedScore) / 100;
  const color = scoreColor(score);
  const label = scoreLabel(score);

  const hasMatches = (result.matches?.length ?? 0) > 0;

  const handleMarkCitation = (match: PlagiarismMatch) => {
    // purely visual; parent result is treated as immutable snapshot
    // so we rely on markedAsCitation only for rendering
    // (non-persistent for now)
    match.markedAsCitation = true;
  };

  return (
    <div className="orig-panel done">
      <div className="top-row">
        <div className="gauge">
          <svg
            viewBox="0 0 120 120"
            className="gauge-svg"
            aria-hidden="true"
          >
            <circle
              className="gauge-bg"
              cx="60"
              cy="60"
              r={radius}
              stroke="rgba(31,41,55,0.9)"
              strokeWidth="10"
              fill="none"
            />
            <circle
              className="gauge-fg"
              cx="60"
              cy="60"
              r={radius}
              stroke={color}
              strokeWidth="10"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <div className="gauge-center">
            <div className="score">{clampedScore}%</div>
            <div className="label">{label}</div>
          </div>
        </div>

        <div className="stats">
          <div className="badge">
            📝{" "}
            <span className="badge-text">
              {result.sentencesAnalysed} sentences analysed
            </span>
          </div>
          <div className="badge">
            🔍{" "}
            <span className="badge-text">
              {result.sourcesSearched} sources searched
            </span>
          </div>
          <div className="badge">
            🌐{" "}
            <span className="badge-text">
              Web + Vector DB
            </span>
          </div>
        </div>
      </div>

      <div className="matches">
        {!hasMatches ? (
          <div className="no-matches">
            <span className="icon">✅</span>
            <div>
              <div className="no-matches-title">
                No significant matches found
              </div>
              <div className="no-matches-sub">
                Content appears highly original within the scanned corpus.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="matches-header">
              Matched Sources ({result.matches.length} found)
            </div>
            <div className="match-list">
              {result.matches.map((m) => {
                const treatedCitation =
                  m.isCitation || m.markedAsCitation;
                return (
                  <div
                    key={`${m.url}-${m.matchedSentence.slice(0, 20)}`}
                    className={`match-card ${
                      treatedCitation ? "citation" : "warning"
                    }`}
                  >
                    <div className="match-top">
                      <span className="pill">
                        {treatedCitation
                          ? "📖 Citation"
                          : "⚠ Match"}
                      </span>
                      <span className="percent">
                        {m.matchPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="source">
                      {m.source}
                    </div>
                    <div className="excerpt">
                      &quot;{m.matchedSentence}&quot;
                    </div>
                    <div className="actions">
                      {m.url && (
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-btn"
                        >
                          🔗 View Source
                        </a>
                      )}
                      {!treatedCitation && (
                        <button
                          type="button"
                          className="mark-btn"
                          onClick={() => handleMarkCitation(m)}
                        >
                          ✓ Mark Citation
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="disclaimer">
        <div className="disc-title">
          ℹ Matches from cited academic sources are expected and normal.
        </div>
        <div className="disc-text">
          This tool uses SearxNG web search and Qdrant semantic
          similarity — not a certified plagiarism database. Use as a
          guide only.
        </div>
        <div className="disc-foot">
          Powered by SearxNG · Qdrant · sentence-transformers · Manthana
          Open Source Stack · ₹0 cost
        </div>
      </div>

      <style jsx>{`
        .orig-panel {
          margin-top: 1.1rem;
          padding: 1rem 1.25rem 1.1rem;
          border-radius: 14px;
          border: 1px solid rgba(55, 65, 81, 0.9);
          background: radial-gradient(
              circle at 0 0,
              rgba(15, 23, 42, 0.95),
              rgba(15, 23, 42, 0.92)
            ),
            rgba(15, 23, 42, 0.96);
        }
        .orig-panel.done {
          border-color: rgba(148, 163, 184, 0.7);
        }
        .top-row {
          display: flex;
          flex-wrap: wrap;
          gap: 1.1rem;
          align-items: center;
        }
        .gauge {
          position: relative;
          width: 140px;
          height: 140px;
        }
        .gauge-svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }
        .gauge-center {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.1rem;
        }
        .score {
          font-family: "Space Mono", monospace;
          font-size: 1.5rem;
          font-weight: 700;
          color: #e5e7eb;
        }
        .label {
          font-family: "Lora", serif;
          font-size: 0.78rem;
          color: rgba(209, 213, 219, 0.9);
        }
        .stats {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          flex: 1;
          min-width: 180px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.6rem;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.45);
          font-size: 0.72rem;
        }
        .badge-text {
          font-family: "Space Mono", monospace;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(209, 213, 219, 0.9);
        }
        .matches {
          margin-top: 0.9rem;
        }
        .matches-header {
          font-family: "Space Mono", monospace;
          font-size: 0.75rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(209, 213, 219, 0.85);
          margin-bottom: 0.4rem;
        }
        .match-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .match-card {
          padding: 0.65rem 0.75rem;
          border-radius: 10px;
          border-width: 1px;
          border-style: solid;
          background: rgba(15, 23, 42, 0.9);
        }
        .match-card.citation {
          border-color: rgba(245, 158, 11, 0.7);
        }
        .match-card.warning {
          border-color: rgba(239, 68, 68, 0.8);
        }
        .match-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.15rem;
        }
        .pill {
          font-family: "Space Mono", monospace;
          font-size: 0.65rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(254, 243, 199, 0.95);
        }
        .percent {
          font-family: "Space Mono", monospace;
          font-size: 0.7rem;
          color: rgba(248, 250, 252, 0.9);
        }
        .source {
          font-family: "Lora", serif;
          font-size: 0.8rem;
          color: rgba(226, 232, 240, 0.95);
        }
        .excerpt {
          margin-top: 0.15rem;
          font-family: "Lora", serif;
          font-size: 0.78rem;
          color: rgba(148, 163, 184, 0.95);
          font-style: italic;
        }
        .actions {
          margin-top: 0.4rem;
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .link-btn,
        .mark-btn {
          font-family: "Space Mono", monospace;
          font-size: 0.65rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 0.25rem 0.7rem;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          background: transparent;
          color: rgba(226, 232, 240, 0.95);
          text-decoration: none;
          cursor: pointer;
        }
        .link-btn {
          border-color: rgba(96, 165, 250, 0.9);
        }
        .mark-btn {
          border-color: rgba(249, 115, 22, 0.9);
        }
        .no-matches {
          display: flex;
          gap: 0.6rem;
          align-items: center;
          padding: 0.65rem 0.75rem;
          border-radius: 10px;
          border: 1px solid rgba(34, 197, 94, 0.7);
          background: rgba(6, 78, 59, 0.25);
        }
        .no-matches .icon {
          font-size: 1.1rem;
        }
        .no-matches-title {
          font-family: "Space Mono", monospace;
          font-size: 0.78rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(187, 247, 208, 0.95);
        }
        .no-matches-sub {
          font-family: "Lora", serif;
          font-size: 0.78rem;
          color: rgba(209, 250, 229, 0.9);
        }
        .disclaimer {
          margin-top: 0.9rem;
          border-radius: 10px;
          padding: 0.7rem 0.85rem;
          background: rgba(251, 191, 36, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.6);
        }
        .disc-title {
          font-family: "Space Mono", monospace;
          font-size: 0.74rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(251, 191, 36, 0.95);
          margin-bottom: 0.25rem;
        }
        .disc-text {
          font-family: "Lora", serif;
          font-size: 0.78rem;
          color: rgba(254, 243, 199, 0.95);
        }
        .disc-foot {
          margin-top: 0.35rem;
          font-family: "Space Mono", monospace;
          font-size: 0.6rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(250, 250, 249, 0.85);
        }
        @media (max-width: 640px) {
          .top-row {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}

