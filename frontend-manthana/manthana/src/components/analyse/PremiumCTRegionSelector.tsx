"use client";

import React from "react";
import {
  PREMIUM_CT_REGION_OPTIONS,
  PREMIUM_CT_REQUIRED_UPLOAD_HINT,
  type PremiumCtRegion,
} from "@/lib/analyse/premium-constants";

interface Props {
  value: PremiumCtRegion;
  onChange: (v: PremiumCtRegion) => void;
}

export default function PremiumCTRegionSelector({ value, onChange }: Props) {
  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: 0,
        borderTop: "1px solid rgba(255,200,120,0.15)",
        borderBottom: "none",
        padding: "10px 16px 14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <p className="text-caption" style={{ fontSize: 9, color: "rgb(255,200,120)" }}>
          Premium 3D CT Region Focus
        </p>
        <span
          className="font-mono"
          style={{
            fontSize: 8,
            color: "rgb(255,200,120)",
            border: "1px solid rgba(255,200,120,0.35)",
            borderRadius: 999,
            padding: "2px 8px",
            letterSpacing: "0.08em",
          }}
        >
          PREMIUM
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {PREMIUM_CT_REGION_OPTIONS.map((opt) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              title={opt.description}
              style={{
                fontSize: 10,
                padding: "5px 10px",
                borderRadius: "var(--r-full)",
                border: active
                  ? "1px solid rgba(255,200,120,0.65)"
                  : "1px solid var(--glass-border)",
                background: active ? "rgba(255,200,120,0.14)" : "rgba(255,255,255,0.03)",
                color: active ? "rgb(255,200,120)" : "var(--text-55)",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="font-body" style={{ marginTop: 8, fontSize: 10, color: "var(--text-35)" }}>
        {PREMIUM_CT_REQUIRED_UPLOAD_HINT}
      </p>
    </div>
  );
}

