"use client";
import React, { useState, useEffect, useCallback } from "react";
import type { HeatmapState, HeatmapColorScheme, Finding } from "@/lib/analyse/types";

interface Props {
  heatmapState: HeatmapState;
  onChange: (state: HeatmapState) => void;
  findingsCount: number;
  findings: Finding[];
  hasHeatmap: boolean;
}

const COLOR_SCHEMES: { id: HeatmapColorScheme; label: string; gradient: string }[] = [
  { id: "jet",     label: "JET",     gradient: "linear-gradient(90deg, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)" },
  { id: "inferno", label: "Inferno", gradient: "linear-gradient(90deg, #000004, #420a68, #932667, #dd513a, #fca50a, #fcffa4)" },
  { id: "viridis", label: "Viridis", gradient: "linear-gradient(90deg, #440154, #31688e, #35b779, #fde725)" },
];

export default function HeatmapControls({ heatmapState, onChange, findingsCount, findings, hasHeatmap }: Props) {
  const [autoHide, setAutoHide] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Auto-hide after 4 seconds of inactivity
  useEffect(() => {
    if (!heatmapState.visible || hovered) {
      setAutoHide(false);
      return;
    }
    const timer = setTimeout(() => setAutoHide(true), 4000);
    return () => clearTimeout(timer);
  }, [heatmapState.visible, hovered]);

  const toggleVisible = useCallback(() => {
    onChange({ ...heatmapState, visible: !heatmapState.visible });
  }, [heatmapState, onChange]);

  const setOpacity = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...heatmapState, opacity: parseFloat(e.target.value) });
    },
    [heatmapState, onChange]
  );

  const setColorScheme = useCallback(
    (scheme: HeatmapColorScheme) => {
      onChange({ ...heatmapState, colorScheme: scheme });
    },
    [heatmapState, onChange]
  );

  const prevFinding = useCallback(() => {
    const current = heatmapState.activeFindingIndex;
    const next = current === null ? 0 : current <= 0 ? findingsCount - 1 : current - 1;
    onChange({ ...heatmapState, activeFindingIndex: next });
  }, [heatmapState, onChange, findingsCount]);

  const nextFinding = useCallback(() => {
    const current = heatmapState.activeFindingIndex;
    const next = current === null ? 0 : current >= findingsCount - 1 ? 0 : current + 1;
    onChange({ ...heatmapState, activeFindingIndex: next });
  }, [heatmapState, onChange, findingsCount]);

  const showAll = useCallback(() => {
    onChange({ ...heatmapState, activeFindingIndex: null });
  }, [heatmapState, onChange]);

  if (!hasHeatmap) return null;

  return (
    <div
      className="heatmap-controls"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        background: "rgba(10, 12, 16, 0.75)",
        backdropFilter: "blur(16px) saturate(120%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "var(--r-full, 999px)",
        opacity: autoHide ? 0.15 : 1,
        transition: "opacity 0.4s ease, transform 0.3s ease",
        whiteSpace: "nowrap",
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleVisible}
        className="btn-ghost"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: "var(--r-full, 999px)",
          border: heatmapState.visible
            ? "1px solid rgba(0, 196, 176, 0.4)"
            : "1px solid rgba(255, 255, 255, 0.1)",
          background: heatmapState.visible
            ? "rgba(0, 196, 176, 0.12)"
            : "rgba(255, 255, 255, 0.04)",
          fontSize: 11,
          color: heatmapState.visible ? "var(--scan-400, #00c4b0)" : "var(--text-40, #666)",
          cursor: "pointer",
          transition: "all 0.3s ease",
        }}
      >
        <span style={{ fontSize: 14 }}>🔥</span>
        <span className="font-display" style={{ letterSpacing: "0.08em", fontSize: 9, textTransform: "uppercase" }}>
          AI Attention
        </span>
      </button>

      {/* Expanded controls — only show when heatmap is visible */}
      {heatmapState.visible && (
        <>
          {/* Separator */}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

          {/* Opacity Slider */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="font-mono" style={{ fontSize: 8, color: "var(--text-30, #555)", letterSpacing: "0.1em" }}>
              OPACITY
            </span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={heatmapState.opacity}
              onChange={setOpacity}
              className="heatmap-slider"
              style={{
                width: 64,
                height: 4,
                appearance: "none",
                WebkitAppearance: "none",
                background: `linear-gradient(90deg, rgba(0,196,176,0.2) 0%, rgba(0,196,176,0.8) ${heatmapState.opacity * 100}%, rgba(255,255,255,0.05) ${heatmapState.opacity * 100}%)`,
                borderRadius: 2,
                outline: "none",
                cursor: "pointer",
              }}
            />
            <span className="font-mono" style={{ fontSize: 9, color: "var(--text-30, #555)", minWidth: 24, textAlign: "right" }}>
              {Math.round(heatmapState.opacity * 100)}%
            </span>
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

          {/* Color Scheme Pills */}
          <div style={{ display: "flex", gap: 4 }}>
            {COLOR_SCHEMES.map((cs) => (
              <button
                key={cs.id}
                onClick={() => setColorScheme(cs.id)}
                title={cs.label}
                style={{
                  width: 28,
                  height: 12,
                  borderRadius: 6,
                  background: cs.gradient,
                  border:
                    heatmapState.colorScheme === cs.id
                      ? "1.5px solid rgba(255,255,255,0.5)"
                      : "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  transition: "border 0.2s ease, transform 0.2s ease",
                  transform: heatmapState.colorScheme === cs.id ? "scale(1.15)" : "scale(1)",
                }}
              />
            ))}
          </div>

          {/* Separator */}
          {findingsCount > 0 && (
            <>
              <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

              {/* Finding Navigator */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={prevFinding}
                  className="btn-ghost"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    color: "var(--text-55, #888)",
                  }}
                >
                  ◀
                </button>
                <button
                  onClick={showAll}
                  className="font-mono"
                  style={{
                    fontSize: 8,
                    color:
                      heatmapState.activeFindingIndex === null
                        ? "var(--scan-400, #00c4b0)"
                        : "var(--text-40, #666)",
                    padding: "2px 8px",
                    borderRadius: "var(--r-full, 999px)",
                    border:
                      heatmapState.activeFindingIndex === null
                        ? "1px solid rgba(0, 196, 176, 0.3)"
                        : "1px solid rgba(255,255,255,0.08)",
                    background:
                      heatmapState.activeFindingIndex === null
                        ? "rgba(0, 196, 176, 0.08)"
                        : "transparent",
                    cursor: "pointer",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {heatmapState.activeFindingIndex === null
                    ? "ALL"
                    : `${heatmapState.activeFindingIndex + 1}/${findingsCount}`}
                </button>
                <button
                  onClick={nextFinding}
                  className="btn-ghost"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    color: "var(--text-55, #888)",
                  }}
                >
                  ▶
                </button>
              </div>

              {/* Active finding label */}
              {heatmapState.activeFindingIndex !== null && findings[heatmapState.activeFindingIndex] && (
                <span
                  className="font-body"
                  style={{
                    fontSize: 9,
                    color: "var(--text-40, #666)",
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {findings[heatmapState.activeFindingIndex].label}
                </span>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
