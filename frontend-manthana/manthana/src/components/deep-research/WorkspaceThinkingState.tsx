"use client";

import { useMemo } from "react";
import type { ActivityLogEntry } from "@/hooks/useDeepResearch";
import {
  generateActivitySequence,
  estimateResearchTime,
} from "@/lib/activity-log-simulator";

interface Props {
  log: ActivityLogEntry[];
  query: string;
  domains: string[];
  depth: string;
  intent: string | null;
  sources: string[];
}

type DisplayRow =
  | (ActivityLogEntry & { simulated?: false })
  | { id: string; text: string; status: "pending"; timestamp: number; simulated: true };

export function WorkspaceThinkingState({
  log,
  query,
  domains,
  depth,
  intent,
  sources,
}: Props) {
  const simulatedLogs = useMemo(
    () =>
      generateActivitySequence({
        domains,
        sources,
        depth,
        intent: intent || "clinical",
      }).map((s) => s.text),
    [domains, sources, depth, intent],
  );

  const displayLogs = useMemo((): DisplayRow[] => {
    if (log.length >= 3) {
      return log.map((e) => ({ ...e, simulated: false }));
    }
    const real = log.map((e) => ({ ...e, simulated: false as const }));
    const progress = log.length;
    const filler = simulatedLogs
      .slice(progress, progress + 4)
      .map((text) => ({
        id: `sim-${text.slice(0, 40)}`,
        text,
        status: "pending" as const,
        timestamp: Date.now(),
        simulated: true as const,
      }));
    return [...real, ...filler];
  }, [log, simulatedLogs]);

  const eta = estimateResearchTime({
    domains,
    depth,
    intent: intent || "clinical",
    targetSeconds: undefined,
  });

  return (
    <div className="thinking-state">
      <div className="thinking-header">
        <div className="thinking-spinner" aria-hidden="true" />
        <div>
          <div className="thinking-title">Researching...</div>
          <div className="thinking-query">{query}</div>
          <div className="thinking-eta" aria-live="polite">
            ~{eta}s estimated
          </div>
        </div>
      </div>

      <div
        className="activity-log"
        role="log"
        aria-live="polite"
        aria-label="Research progress"
      >
        {displayLogs.map((entry) => {
          const isSim = "simulated" in entry && entry.simulated === true;
          return (
            <div
              key={entry.id}
              className={`log-entry ${entry.status}${isSim ? " simulated" : ""}`}
            >
              <span className="log-indicator">
                {isSim ? (
                  <span className="log-spinner simulated-pulse" aria-label="Pending" />
                ) : entry.status === "done" ? (
                  <span className="log-check">✓</span>
                ) : entry.status === "active" ? (
                  <span className="log-spinner" aria-label="In progress" />
                ) : (
                  <span className="log-dot" />
                )}
              </span>
              <span className="log-text">{entry.text}</span>
            </div>
          );
        })}
      </div>

      <div className="thinking-waveform" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="wave-bar"
            style={{ animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>

      <style jsx>{`
        .thinking-state {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 2rem;
          min-height: 400px;
        }
        .thinking-header {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .thinking-spinner {
          width: 36px;
          height: 36px;
          border: 2px solid rgba(124, 58, 237, 0.2);
          border-top-color: #7c3aed;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .thinking-title {
          font-family: "Space Mono", monospace;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #7c3aed;
        }
        .thinking-query {
          font-family: "Lora", serif;
          font-size: 0.9rem;
          color: rgba(245, 239, 232, 0.7);
          font-style: italic;
          margin-top: 0.25rem;
        }
        .thinking-eta {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.65rem;
          color: rgba(245, 239, 232, 0.45);
          margin-top: 0.35rem;
        }
        .activity-log {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-family: "JetBrains Mono", "Space Mono", monospace;
          font-size: 0.72rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 10px;
          padding: 1.25rem;
        }
        .log-entry {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          color: rgba(245, 239, 232, 0.55);
        }
        .log-entry.active {
          color: #f5efe8;
        }
        .log-entry.simulated {
          opacity: 0.5;
          font-style: italic;
          animation: pulseSim 1.8s ease-in-out infinite;
        }
        @keyframes pulseSim {
          0%,
          100% {
            opacity: 0.45;
          }
          50% {
            opacity: 0.65;
          }
        }
        .log-indicator {
          width: 14px;
          display: flex;
          justify-content: center;
        }
        .log-check {
          color: #c8922a;
          font-size: 0.75rem;
        }
        .log-dot {
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: rgba(245, 239, 232, 0.3);
        }
        .log-spinner {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          border: 2px solid rgba(124, 58, 237, 0.25);
          border-top-color: #7c3aed;
          animation: spin 0.8s linear infinite;
        }
        .log-spinner.simulated-pulse {
          border-color: rgba(124, 58, 237, 0.15);
          border-top-color: rgba(124, 58, 237, 0.45);
        }
        .thinking-waveform {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 32px;
        }
        .wave-bar {
          flex: 1;
          border-radius: 999px;
          background: linear-gradient(
            to top,
            rgba(124, 58, 237, 0.1),
            rgba(124, 58, 237, 0.7)
          );
          animation: wave 1.6s ease-in-out infinite;
        }
        @keyframes wave {
          0%,
          100% {
            height: 6px;
            opacity: 0.4;
          }
          50% {
            height: 28px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
