"use client";
import React, { useState } from "react";
import type { AnalysisMode } from "@/lib/analyse/types";

interface Props {
  mode: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
  disabled?: boolean;
}

export default function AnalysisModeSwitcher({ mode, onChange, disabled }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
      {/* Toggle pill container */}
      <div
        style={{
          display: "flex",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--glass-border)",
          borderRadius: "var(--r-full)",
          padding: 2,
          gap: 2,
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        {/* Single Model */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onChange("single"); setShowTooltip(false); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onChange("single"); setShowTooltip(false); } }}
          style={{
            padding: "4px 10px",
            borderRadius: "var(--r-full)",
            border: "none",
            cursor: "pointer",
            fontSize: 8,
            fontFamily: "var(--font-display)",
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            background: mode === "single"
              ? "rgba(0,196,176,0.15)"
              : "transparent",
            color: mode === "single"
              ? "var(--scan-400)"
              : "var(--text-30)",
            boxShadow: mode === "single"
              ? "0 0 8px rgba(0,196,176,0.2)"
              : "none",
            userSelect: "none" as const,
          }}
        >
          Single Model
        </div>

        {/* Multi Model */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onChange("multi"); setShowTooltip(true); setTimeout(() => setShowTooltip(false), 4000); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onChange("multi"); setShowTooltip(true); setTimeout(() => setShowTooltip(false), 4000); } }}
          style={{
            padding: "4px 10px",
            borderRadius: "var(--r-full)",
            border: "none",
            cursor: "pointer",
            fontSize: 8,
            fontFamily: "var(--font-display)",
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            background: mode === "multi"
              ? "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.08))"
              : "transparent",
            color: mode === "multi"
              ? "var(--gold-300)"
              : "var(--text-30)",
            boxShadow: mode === "multi"
              ? "0 0 12px rgba(212,175,55,0.15)"
              : "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            userSelect: "none" as const,
          }}
        >
          <span>Multi-Model</span>
          <span
            aria-hidden
            style={{
              fontSize: 15,
              lineHeight: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: mode === "multi" ? "var(--gold-300)" : "var(--scan-400)",
              opacity: mode === "multi" ? 1 : 0.92,
              fontWeight: 600,
              animation: mode === "multi" ? "pulse 2s ease-in-out infinite" : "none",
            }}
          >
            ✦
          </span>
        </div>
      </div>

      {/* Notification tooltip on multi-model switch */}
      {showTooltip && mode === "multi" && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, rgba(10,14,28,0.98), rgba(15,20,35,0.98))",
            border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: "var(--r-md)",
            padding: "10px 14px",
            width: 280,
            zIndex: 100,
            animation: "fadeIn 0.3s ease-out",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 16px rgba(212,175,55,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span className="font-mono" style={{ fontSize: 8, fontWeight: 700, color: "var(--gold-300)", letterSpacing: "0.08em" }}>AI</span>
            <span
              className="font-display"
              style={{ fontSize: 9, color: "var(--gold-300)", letterSpacing: "0.1em", textTransform: "uppercase" }}
            >
              Advanced Feature
            </span>
          </div>
          <p
            className="font-body"
            style={{ fontSize: 10, color: "var(--text-60)", lineHeight: 1.5, margin: 0 }}
          >
            Analyze multiple modalities for the same patient. AI combines CT, X-Ray, Lab Reports etc. into one unified diagnosis for higher accuracy.
          </p>
          {/* Arrow */}
          <div
            style={{
              position: "absolute",
              top: -5,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 10,
              height: 10,
              background: "rgba(10,14,28,0.98)",
              borderLeft: "1px solid rgba(212,175,55,0.2)",
              borderTop: "1px solid rgba(212,175,55,0.2)",
            }}
          />
        </div>
      )}
    </div>
  );
}
