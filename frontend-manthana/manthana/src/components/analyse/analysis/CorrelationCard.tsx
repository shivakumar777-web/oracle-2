"use client";

import React from "react";
import type { CorrelationFinding } from "@/lib/analyse/types";

const severityColor: Record<string, string> = {
  critical: "var(--critical, #f87171)",
  high: "var(--warning, #fbbf24)",
  warning: "var(--scan-400, #5eead4)",
  info: "var(--text-50, #94a3b8)",
};

export default function CorrelationCard({ correlation }: { correlation: CorrelationFinding }) {
  const c = severityColor[correlation.clinical_significance] ?? severityColor.info;
  return (
    <div
      className="glass-panel"
      style={{
        padding: "12px 14px",
        marginBottom: 10,
        borderLeft: `3px solid ${c}`,
        borderRadius: 8,
        background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }} aria-hidden>
          🔗
        </span>
        <span className="text-caption" style={{ color: c, fontSize: 10, letterSpacing: "0.06em" }}>
          {correlation.clinical_significance.toUpperCase()}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-40)" }}>
          {(correlation.confidence * 100).toFixed(0)}% match
        </span>
      </div>
      <p className="font-body" style={{ fontSize: 12, color: "var(--text-80)", marginBottom: 8 }}>
        {correlation.pattern}
      </p>
      <div style={{ fontSize: 9, color: "var(--text-50)", marginBottom: 6 }}>
        Modalities: {correlation.matching_modalities.join(" · ")}
      </div>
      <p className="font-body" style={{ fontSize: 11, color: "var(--gold-300)", lineHeight: 1.5 }}>
        {correlation.action}
      </p>
    </div>
  );
}
