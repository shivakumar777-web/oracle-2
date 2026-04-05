"use client";
import React from "react";
import { MODALITIES } from "@/lib/analyse/constants";
import type { MultiModelUpload } from "@/lib/analyse/types";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";

interface Props {
  uploads: MultiModelUpload[];
  onActivate: () => void;
  onBack: () => void;
}

export default function CopilotActivation({ uploads, onActivate, onBack }: Props) {
  const { isMobile, isTablet } = useMediaQuery();
  const compact = isMobile || isTablet;
  const totalFiles = uploads.reduce((sum, u) => sum + u.files.length, 0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <div
        style={{
          width: compact ? "95%" : "90%",
          maxWidth: compact ? "none" : 480,
          background: "linear-gradient(145deg, rgba(8,12,24,0.98), rgba(12,18,32,0.98))",
          border: "1px solid rgba(212,175,55,0.2)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(212,175,55,0.06)",
          animation: "fadeIn 0.4s ease-out",
        }}
      >
        {/* Header with animated glow */}
        <div
          style={{
            padding: compact ? "20px 16px 16px" : "28px 28px 20px",
            textAlign: "center",
            position: "relative",
          }}
        >
          {/* Glow orb */}
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)",
              border: "2px solid rgba(212,175,55,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--gold-300)", letterSpacing: "0.1em" }}>AI</span>
          </div>

          <h2
            className="font-display"
            style={{
              fontSize: 14,
              color: "var(--gold-300)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              margin: "0 0 8px",
            }}
          >
            Activate Radiologist Copilot
          </h2>
          <p
            className="font-body"
            style={{ fontSize: 12, color: "var(--text-50)", lineHeight: 1.6, margin: 0 }}
          >
            AI will process {uploads.length} modalities sequentially, then synthesize a unified cross-modality report
          </p>
        </div>

        {/* Modality summary list */}
        <div
          style={{
            padding: compact ? "0 16px 16px" : "0 28px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {uploads.map((u, i) => {
            const info = MODALITIES.find((m) => m.id === u.modality);
            return (
              <div
                key={u.modality}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: "var(--r-sm)",
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(212,175,55,0.08)",
                    border: "1px solid rgba(212,175,55,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    color: "var(--gold-300)",
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--gold-300)" }}>{info?.icon}</span>
                <div style={{ flex: 1 }}>
                  <p
                    className="font-display"
                    style={{ fontSize: 11, color: "var(--text-80)", margin: 0 }}
                  >
                    {info?.label || u.modality}
                  </p>
                  <p
                    className="font-mono"
                    style={{ fontSize: 9, color: "var(--text-20)", margin: 0 }}
                  >
                    {u.files.length} file{u.files.length > 1 ? "s" : ""}
                  </p>
                </div>
                <span style={{ fontSize: 11, color: "var(--clear)" }}>✓</span>
              </div>
            );
          })}
        </div>

        {/* Process description */}
        <div
          style={{
            padding: compact ? "12px 16px" : "14px 28px",
            background: "rgba(212,175,55,0.02)",
            borderTop: "1px solid rgba(212,175,55,0.06)",
            borderBottom: "1px solid rgba(212,175,55,0.06)",
          }}
        >
          <div
            className="font-body"
            style={{ fontSize: 10, color: "var(--text-40)", lineHeight: 1.6 }}
          >
            <p style={{ margin: "0 0 6px" }}>
              <strong style={{ color: "var(--gold-300)" }}>Processing Pipeline:</strong>
            </p>
            <p style={{ margin: "0 0 3px", paddingLeft: 12 }}>
              1. Analyze each modality with specialized AI models
            </p>
            <p style={{ margin: "0 0 3px", paddingLeft: 12 }}>
              2. Generate individual findings per modality
            </p>
            <p style={{ margin: 0, paddingLeft: 12 }}>
              3. Clinical language model synthesizes unified cross-modality diagnosis
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div
          style={{
            padding: compact ? "16px 16px 20px" : "20px 28px 24px",
            display: "flex",
            flexDirection: compact ? "column" : "row" as const,
            gap: 10,
          }}
        >
          <button
            className="btn-ghost"
            onClick={onBack}
            style={{
              flex: 1,
              padding: "10px 16px",
              fontSize: 11,
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--r-sm)",
            }}
          >
            ← Back
          </button>
          <button
            className="btn-gold"
            onClick={onActivate}
            style={{
              flex: 2,
              padding: "10px 24px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span>✦</span>
            <span>Yes, Activate Copilot</span>
          </button>
        </div>
      </div>
    </div>
  );
}
