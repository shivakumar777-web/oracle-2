"use client";
import React from "react";
import { MODALITIES } from "@/lib/analyse/constants";
import type { MultiModelSession } from "@/lib/analyse/types";

interface Props {
  session: MultiModelSession;
}

export default function MultiModelProgress({ session }: Props) {
  const { stage, uploads, currentProcessingIndex, individualResults } = session;
  const isProcessing = stage === "processing";
  const isUnifying = stage === "unifying";
  const total = uploads.length;
  const current = currentProcessingIndex;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        gap: 24,
      }}
    >
      {/* Animated brain orb */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
          border: "2px solid rgba(212,175,55,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          animation: "pulse 2s ease-in-out infinite",
          boxShadow: "0 0 40px rgba(212,175,55,0.08)",
        }}
      >
        {isUnifying ? (
          <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--gold-300)", letterSpacing: "0.1em" }}>UNIFY</span>
        ) : (
          <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--gold-300)", letterSpacing: "0.1em" }}>AI</span>
        )}
      </div>

      {/* Stage label */}
      <div style={{ textAlign: "center" }}>
        <p
          className="text-caption"
          style={{
            color: "var(--gold-300)",
            fontSize: 10,
            animation: "pulse 2s ease-in-out infinite",
            marginBottom: 6,
          }}
        >
          {isUnifying
            ? "SYNTHESIZING UNIFIED REPORT…"
            : `ANALYZING MODALITY ${current + 1} OF ${total}…`}
        </p>
        <p className="font-body" style={{ fontSize: 11, color: "var(--text-40)" }}>
          {isUnifying
            ? "Clinical language model is cross-referencing all modality findings"
            : (() => {
                const modInfo = MODALITIES.find((m) => m.id === uploads[current]?.modality);
                return `Processing ${modInfo?.label || uploads[current]?.modality} scan`;
              })()}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ width: "80%", maxWidth: 280 }}>
        <div
          style={{
            height: 3,
            background: "rgba(255,255,255,0.05)",
            borderRadius: "var(--r-full)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: "var(--r-full)",
              background: "linear-gradient(90deg, var(--gold-500), var(--scan-500))",
              transition: "width 0.5s ease-out",
              width: isUnifying
                ? "90%"
                : `${((individualResults.length) / total) * 80}%`,
            }}
          />
        </div>
      </div>

      {/* Modality progress dots */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {uploads.map((u, i) => {
          const info = MODALITIES.find((m) => m.id === u.modality);
          const isDone = i < individualResults.length;
          const isCurrent = isProcessing && i === current;

          return (
            <div
              key={u.modality}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: `1.5px solid ${
                    isDone
                      ? "rgba(48,209,88,0.4)"
                      : isCurrent
                      ? "rgba(212,175,55,0.4)"
                      : "rgba(255,255,255,0.08)"
                  }`,
                  background: isDone
                    ? "rgba(48,209,88,0.06)"
                    : isCurrent
                    ? "rgba(212,175,55,0.06)"
                    : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  transition: "all 0.5s",
                  animation: isCurrent ? "pulse 1.5s ease-in-out infinite" : "none",
                }}
              >
                {isDone ? (
                  <span style={{ fontSize: 14, color: "var(--clear)" }}>✓</span>
                ) : (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", color: isCurrent ? "var(--gold-300)" : "var(--text-40)" }}>{info?.icon}</span>
                )}
              </div>
              <span
                className="font-mono"
                style={{
                  fontSize: 7,
                  color: isDone ? "var(--clear)" : isCurrent ? "var(--gold-300)" : "var(--text-20)",
                  textTransform: "uppercase",
                }}
              >
                {info?.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Unifying phase indicator */}
      {isUnifying && (
        <div
          style={{
            padding: "10px 20px",
            background: "rgba(212,175,55,0.04)",
            border: "1px solid rgba(212,175,55,0.1)",
            borderRadius: "var(--r-md)",
            animation: "fadeIn 0.5s ease-out",
          }}
        >
          <p
            className="font-body"
            style={{ fontSize: 10, color: "var(--text-40)", margin: 0, textAlign: "center" }}
          >
            All {total} modalities analyzed ✓ — Clinical language model is generating<br/>
            the unified cross-modality diagnosis…
          </p>
        </div>
      )}
    </div>
  );
}
