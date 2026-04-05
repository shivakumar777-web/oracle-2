"use client";
import React from "react";
import type { Finding, Severity } from "@/lib/analyse/types";
import { SEVERITY_CONFIG } from "@/lib/analyse/constants";

interface Props {
  finding: Finding;
  index: number;
  onClick?: () => void;
  isActive?: boolean; // Heatmap highlighted
  onToggleHeatmap?: () => void;
}

export default function FindingCard({ finding, index, onClick, isActive, onToggleHeatmap }: Props) {
  const cfg = SEVERITY_CONFIG[finding.severity];
  const pct = finding.confidence;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={isActive ? "finding-card--active" : ""}
      style={{
        background: cfg.bg,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: "var(--r-sm)",
        padding: "12px 14px",
        cursor: onClick ? "pointer" : "default",
        animation: `slideInRight 0.4s ${index * 0.15}s var(--ease-out-expo) both`,
        transition: "background var(--dur-fast), box-shadow var(--dur-fast), border-color 0.3s ease",
        boxShadow: isActive
          ? `0 0 12px ${cfg.color}40, inset 0 0 0 1px ${cfg.color}30`
          : "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          cfg.bg.replace("0.08", "0.14");
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = cfg.bg;
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Severity dot */}
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: cfg.color,
              flexShrink: 0,
              boxShadow: `0 0 6px ${cfg.color}`,
            }}
          />
          <span
            className="font-display"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-100)",
            }}
          >
            {finding.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Heatmap eye button */}
          {onToggleHeatmap && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleHeatmap();
              }}
              title="Show AI attention region"
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                border: isActive
                  ? `1px solid ${cfg.color}50`
                  : "1px solid rgba(255,255,255,0.08)",
                background: isActive
                  ? `${cfg.color}15`
                  : "rgba(255,255,255,0.03)",
                cursor: "pointer",
                transition: "all 0.3s ease",
                color: isActive ? cfg.color : "var(--text-30)",
                padding: 0,
                lineHeight: 1,
              }}
            >
              👁
            </button>
          )}

          {/* Confidence % */}
          <span
            className="font-mono"
            style={{ fontSize: 12, color: cfg.color, fontWeight: 500 }}
          >
            {pct}%
          </span>
        </div>
      </div>

      {/* Region / description */}
      {finding.region && (
        <p
          className="font-body"
          style={{
            fontSize: 11,
            color: "var(--text-55)",
            marginBottom: 6,
            fontStyle: "italic",
          }}
        >
          {finding.region}
        </p>
      )}

      {/* Confidence bar */}
      <div
        style={{
          height: 3,
          borderRadius: 2,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: cfg.color,
            borderRadius: 2,
            transition: "width 1.2s var(--ease-spring)",
            boxShadow: `0 0 8px ${cfg.color}`,
          }}
        />
      </div>

      {/* Severity label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <span
          className="text-caption"
          style={{ color: cfg.color, opacity: 0.7, fontSize: 9 }}
        >
          {cfg.label}
        </span>
        {onClick && (
          <span
            className="font-display"
            style={{ fontSize: 9, color: isActive ? cfg.color : "var(--text-30)", cursor: "pointer" }}
          >
            {isActive ? "✦ Focused" : "▸ Locate"}
          </span>
        )}
      </div>
    </div>
  );
}
