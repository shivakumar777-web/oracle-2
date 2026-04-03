"use client";

import {
  DEPTH_CONFIG,
  CITATION_STYLES,
  RESEARCH_DOMAINS,
  type DepthLevel,
  type OutputFormat,
  type CitationStyle,
} from "@/lib/deep-research-config";

interface Props {
  depth: DepthLevel;
  depthSeconds: number;
  outputFormat: OutputFormat;
  citationStyle: CitationStyle;
  selectedDomains: string[];
  onDepthChange: (d: DepthLevel) => void;
  onDepthSecondsChange: (seconds: number) => void;
  onFormatChange: (f: OutputFormat) => void;
  onCitationStyleChange: (s: CitationStyle) => void;
}

export function DepthControls({
  depth,
  depthSeconds,
  outputFormat,
  citationStyle,
  selectedDomains,
  onDepthChange,
  onDepthSecondsChange,
  onFormatChange,
  onCitationStyleChange,
}: Props) {
  const levels: DepthLevel[] = ["focused", "comprehensive", "exhaustive"];

  // Universal Search: automatically selects all relevant sources for chosen domains
  const activeSources = selectedDomains.flatMap((domainId) => {
    const domain = RESEARCH_DOMAINS.find((d) => d.id === domainId);
    return domain?.defaultSources || [];
  });
  const uniqueSources = Array.from(new Set(activeSources));

  const formatSeconds = (s: number): string => {
    if (s < 60) return `${s}s`;
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    if (seconds === 0) return `${minutes}m`;
    return `${minutes}m ${seconds}s`;
  };

  const handleSliderChange = (value: number) => {
    const clamped = Math.min(600, Math.max(15, value));
    onDepthSecondsChange(clamped);
    let next: DepthLevel;
    if (clamped <= 45) next = "focused";
    else if (clamped <= 180) next = "comprehensive";
    else next = "exhaustive";
    if (next !== depth) onDepthChange(next);
  };

  return (
    <div className="depth-controls">
      <div className="control-group">
        <div className="control-label">Research Depth</div>
        <div className="depth-tabs">
          {levels.map((level) => {
            const cfg = DEPTH_CONFIG[level];
            return (
              <button
                key={level}
                className={`depth-tab ${depth === level ? "active" : ""}`}
                onClick={() => onDepthChange(level)}
              >
                <span className="depth-icon">{cfg.icon}</span>
                <span className="depth-name">{cfg.label}</span>
                <span className="depth-est">
                  ~{cfg.estimatedSeconds}
                  s
                </span>
              </button>
            );
          })}
        </div>
        {depth === "exhaustive" && (
          <div className="exhaustive-warning">
            ⚠ {DEPTH_CONFIG.exhaustive.warning}
          </div>
        )}
        <div className="depth-slider">
          <div className="depth-slider-row">
            <span className="depth-slider-label">
              Target time: {formatSeconds(depthSeconds)}
            </span>
            <span className="depth-slider-minmax">15s · 10m</span>
          </div>
          <input
            type="range"
            min={15}
            max={600}
            step={15}
            value={depthSeconds}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="control-group">
        <div className="control-label">
          {selectedDomains.length === 0
            ? "Sources (select domains)"
            : "Universal Search"}
        </div>
        {selectedDomains.length === 0 ? (
          <div className="universal-hint">
            Choose at least one medical tradition to activate universal search
            across relevant databases.
          </div>
        ) : (
          <div className="universal-search-badge">
            <span className="universal-icon">🌐</span>
            <span className="universal-text">
              Searching {uniqueSources.length} databases for{" "}
              {selectedDomains.length} tradition
              {selectedDomains.length > 1 ? "s" : ""}
            </span>
            <span className="universal-sources" title={uniqueSources.join(", ")}>
              {uniqueSources.slice(0, 4).join(", ")}
              {uniqueSources.length > 4
                ? ` +${uniqueSources.length - 4} more`
                : ""}
            </span>
          </div>
        )}
      </div>

      <div className="control-group">
        <div className="control-label">Output Format</div>
        <div className="segmented-control">
          {(["structured", "summary", "bullets"] as OutputFormat[]).map(
            (fmt) => (
              <button
                key={fmt}
                className={`segment ${
                  outputFormat === fmt ? "active" : ""
                }`}
                onClick={() => onFormatChange(fmt)}
              >
                {fmt === "structured"
                  ? "📄 Report"
                  : fmt === "summary"
                  ? "📝 Summary"
                  : "• Bullets"}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="control-group">
        <div className="control-label">Citation Style</div>
        <div className="segmented-control">
          {CITATION_STYLES.map((style) => (
            <button
              key={style.id}
              className={`segment ${
                citationStyle === style.id ? "active" : ""
              }`}
              onClick={() => onCitationStyleChange(style.id)}
              title={style.description}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .depth-controls {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .control-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .control-label {
          font-family: "Space Mono", monospace;
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(245, 239, 232, 0.35);
        }
        .depth-tabs {
          display: flex;
          gap: 0.35rem;
        }
        .depth-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.1rem;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          border: 1px solid rgba(245, 240, 232, 0.1);
          background: rgba(5, 4, 15, 0.9);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .depth-tab:hover {
          border-color: rgba(124, 58, 237, 0.4);
        }
        .depth-tab.active {
          border-color: #7c3aed;
          background: radial-gradient(
            ellipse at 50% 0%,
            rgba(124, 58, 237, 0.2),
            transparent 70%
          );
        }
        .depth-icon {
          font-size: 0.9rem;
        }
        .depth-name {
          font-family: "Space Mono", monospace;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #f5efe8;
        }
        .depth-est {
          font-family: "Space Mono", monospace;
          font-size: 0.55rem;
          color: rgba(245, 239, 232, 0.4);
        }
        .depth-slider {
          margin-top: 0.4rem;
        }
        .depth-slider-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.15rem;
        }
        .depth-slider-label {
          font-family: "Space Mono", monospace;
          font-size: 0.55rem;
          color: rgba(245, 239, 232, 0.65);
        }
        .depth-slider-minmax {
          font-family: "Space Mono", monospace;
          font-size: 0.5rem;
          color: rgba(245, 239, 232, 0.35);
        }
        .depth-slider input[type="range"] {
          width: 100%;
        }
        .exhaustive-warning {
          font-family: "Space Mono", monospace;
          font-size: 0.6rem;
          color: rgba(255, 193, 7, 0.9);
          margin-top: 0.3rem;
        }
        .universal-hint {
          font-size: 0.72rem;
          color: rgba(245, 239, 232, 0.5);
          line-height: 1.45;
          padding: 0.5rem 0;
        }
        .universal-search-badge {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          border: 1px solid rgba(34, 197, 94, 0.25);
          background: rgba(34, 197, 94, 0.06);
        }
        .universal-icon {
          font-size: 1rem;
        }
        .universal-text {
          font-size: 0.7rem;
          color: rgba(167, 243, 208, 0.9);
          font-weight: 500;
        }
        .universal-sources {
          font-size: 0.62rem;
          color: rgba(245, 239, 232, 0.45);
          font-family: "Space Mono", monospace;
        }
        .segmented-control {
          display: flex;
          gap: 0.35rem;
        }
        .segment {
          flex: 1;
          font-family: "Space Mono", monospace;
          font-size: 0.6rem;
          padding: 0.35em 0.5em;
          border-radius: 8px;
          border: 1px solid rgba(245, 240, 232, 0.12);
          background: rgba(5, 4, 15, 0.9);
          color: rgba(245, 239, 232, 0.75);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .segment.active {
          border-color: #c8922a;
          background: rgba(200, 146, 42, 0.12);
          color: #f5efe8;
        }
      `}</style>
    </div>
  );
}

