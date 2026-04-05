"use client";
import React from "react";

interface Props {
  visible: boolean;
}

export default function HeatmapLegend({ visible }: Props) {
  if (!visible) return null;

  return (
    <div
      className="heatmap-legend"
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: 18,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "8px 6px",
        background: "rgba(10, 12, 16, 0.65)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "var(--r-sm, 8px)",
        animation: "fadeIn 0.5s ease-out",
        pointerEvents: "none",
      }}
    >
      {/* Label: High */}
      <span
        className="font-mono"
        style={{
          fontSize: 7,
          color: "var(--text-30, #555)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        HIGH
      </span>

      {/* Gradient bar */}
      <div
        style={{
          width: 10,
          height: 80,
          borderRadius: 5,
          background: "linear-gradient(180deg, #ff0000 0%, #ffff00 25%, #00ff00 50%, #00ffff 75%, #0000ff 100%)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      />

      {/* Label: Low */}
      <span
        className="font-mono"
        style={{
          fontSize: 7,
          color: "var(--text-30, #555)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        LOW
      </span>

      {/* Caption */}
      <span
        className="font-mono"
        style={{
          fontSize: 6,
          color: "var(--text-15, #333)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          marginTop: 4,
        }}
      >
        AI ATTENTION
      </span>
    </div>
  );
}
