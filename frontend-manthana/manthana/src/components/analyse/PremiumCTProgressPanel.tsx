"use client";

import React from "react";

export type PremiumCtProcessingStep =
  | "upload_validate"
  | "vista_segmentation"
  | "volume_measurements"
  | "narrative";

interface Props {
  step: PremiumCtProcessingStep;
}

const STEPS: Array<{ id: PremiumCtProcessingStep; label: string; eta: string }> = [
  { id: "upload_validate", label: "Upload + volumetric validation", eta: "10-20s" },
  { id: "vista_segmentation", label: "VISTA-3D full 127-class segmentation", eta: "2-4 min" },
  { id: "volume_measurements", label: "Volume measurements + clinical extraction", eta: "20-40s" },
  { id: "narrative", label: "Premium narrative synthesis (Kimi K2.5)", eta: "15-30s" },
];

export default function PremiumCTProgressPanel({ step }: Props) {
  const currentIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.id === step)
  );
  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
        borderColor: "rgba(255,200,120,0.22)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="text-caption" style={{ fontSize: 9, color: "rgb(255,200,120)" }}>
          Premium 3D CT Processing
        </span>
        <span className="font-mono" style={{ fontSize: 8, color: "var(--text-35)" }}>
          STEP {currentIdx + 1}/{STEPS.length}
        </span>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {STEPS.map((s, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderRadius: 8,
                padding: "6px 8px",
                border: done || active ? "1px solid rgba(255,200,120,0.30)" : "1px solid rgba(255,255,255,0.06)",
                background: active
                  ? "rgba(255,200,120,0.10)"
                  : done
                  ? "rgba(48,209,88,0.08)"
                  : "rgba(255,255,255,0.02)",
              }}
            >
              <span className="font-body" style={{ fontSize: 10, color: active ? "rgb(255,220,160)" : "var(--text-45)" }}>
                {done ? "✓ " : active ? "• " : ""}
                {s.label}
              </span>
              <span className="font-mono" style={{ fontSize: 8, color: "var(--text-30)" }}>
                {s.eta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

