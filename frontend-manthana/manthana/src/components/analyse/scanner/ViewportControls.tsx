"use client";
import React from "react";

interface Props {
  zoom: number;
  onZoomChange: (z: number) => void;
  onFullscreen?: () => void;
  hasImage: boolean;
}

export default function ViewportControls({
  zoom,
  onZoomChange,
  onFullscreen,
  hasImage,
}: Props) {
  if (!hasImage) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        borderTop: "1px solid var(--glass-border)",
        background: "rgba(0,0,0,0.3)",
      }}
    >
      {/* Zoom controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="btn-ghost"
          style={{ padding: "4px 8px", fontSize: 14 }}
          onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
          title="Zoom out (−)"
        >
          −
        </button>
        <span
          className="font-display"
          style={{ fontSize: 11, color: "var(--text-55)", minWidth: 44, textAlign: "center" }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="btn-ghost"
          style={{ padding: "4px 8px", fontSize: 14 }}
          onClick={() => onZoomChange(Math.min(4, zoom + 0.25))}
          title="Zoom in (+)"
        >
          +
        </button>
        <button
          className="btn-ghost"
          style={{ padding: "4px 8px", fontSize: 10 }}
          onClick={() => onZoomChange(1)}
          title="Reset zoom (0)"
        >
          FIT
        </button>
      </div>

      {/* Fullscreen */}
      <button
        className="btn-ghost"
        style={{ fontSize: 15, padding: 6 }}
        onClick={onFullscreen}
        title="Fullscreen (F)"
      >
        ⛶
      </button>
    </div>
  );
}
