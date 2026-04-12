"use client";
import React, { useState, useCallback, useRef } from "react";
import { MODALITIES, getUploadAcceptTypes } from "@/lib/analyse/constants";
import type { MultiModelUpload } from "@/lib/analyse/types";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";

interface Props {
  uploads: MultiModelUpload[];
  onSetFiles: (modalityId: string, files: File[]) => void;
  onComplete: () => void;
  onBack: () => void;
  pro2dOnly?: boolean;
}

export default function MultiModelUploadWizard({
  uploads,
  onSetFiles,
  onComplete,
  onBack,
  pro2dOnly,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isMobile, isTablet } = useMediaQuery();
  const compact = isMobile || isTablet;
  const current = uploads[currentStep];
  const modalityInfo = MODALITIES.find((m) => m.id === current?.modality);
  const isLast = currentStep === uploads.length - 1;
  const allUploaded = uploads.every((u) => u.uploaded);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && current) {
        onSetFiles(current.modality, files);
      }
    },
    [current, onSetFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0 && current) {
        onSetFiles(current.modality, files);
      }
      e.target.value = "";
    },
    [current, onSetFiles]
  );

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep === 0) {
      onBack();
    } else {
      setCurrentStep((s) => s - 1);
    }
  };

  if (!current) return null;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* ── Stepper Header ── */}
      <div
        className="glass-panel"
        style={{
          borderRadius: "var(--r-md) var(--r-md) 0 0",
          borderBottom: "none",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <span
            className="text-caption"
            style={{ color: "var(--gold-300)", fontSize: 9 }}
          >
            ✦ MULTI-MODEL UPLOAD
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              color: "var(--text-30)",
              padding: "2px 8px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "var(--r-full)",
            }}
          >
            Step {currentStep + 1} of {uploads.length}
          </span>
        </div>

        {/* Step indicators */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {uploads.map((u, i) => {
            const info = MODALITIES.find((m) => m.id === u.modality);
            const isCurrent = i === currentStep;
            const isDone = u.uploaded;

            return (
              <React.Fragment key={u.modality}>
                {i > 0 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: isDone || isCurrent
                        ? "rgba(212,175,55,0.3)"
                        : "rgba(255,255,255,0.06)",
                      transition: "background 0.3s",
                    }}
                  />
                )}
                <button
                  onClick={() => setCurrentStep(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 10px",
                    borderRadius: "var(--r-full)",
                    border: `1px solid ${
                      isCurrent
                        ? "rgba(212,175,55,0.3)"
                        : isDone
                        ? "rgba(48,209,88,0.2)"
                        : "var(--glass-border)"
                    }`,
                    background: isCurrent
                      ? "rgba(212,175,55,0.08)"
                      : isDone
                      ? "rgba(48,209,88,0.05)"
                      : "transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-display)",
                    fontSize: 9,
                    color: isCurrent
                      ? "var(--gold-300)"
                      : isDone
                      ? "var(--clear)"
                      : "var(--text-30)",
                    transition: "all 0.3s",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.08em" }}>{info?.icon}</span>
                  {!compact && <span>{info?.label}</span>}
                  {isDone && <span style={{ fontSize: 10 }}>✓</span>}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Drop Zone ── */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "2px dashed rgba(212,175,55,0.15)",
          borderRadius: 0,
          background: "rgba(0,0,0,0.3)",
          padding: compact ? 16 : 32,
          gap: compact ? 10 : 16,
          cursor: "pointer",
          minHeight: compact ? 180 : 280,
          transition: "all 0.3s",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        {current.uploaded && current.urls.length > 0 ? (
          /* ── Uploaded Preview ── */
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              {current.urls.slice(0, 4).map((url, i) => (
                <div
                  key={i}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "var(--r-sm)",
                    overflow: "hidden",
                    border: "1px solid rgba(212,175,55,0.2)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Upload ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
              {current.files.length > 4 && (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--glass-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-30)",
                    fontSize: 12,
                  }}
                >
                  +{current.files.length - 4}
                </div>
              )}
            </div>
            <p className="font-body" style={{ fontSize: 11, color: "var(--clear)" }}>
              ✓ {current.files.length} file{current.files.length > 1 ? "s" : ""} uploaded
            </p>
            <p className="font-body" style={{ fontSize: 10, color: "var(--text-30)", marginTop: 4 }}>
              Click or drop to replace
            </p>
          </div>
        ) : (
          /* ── Empty Drop Zone ── */
          <>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: "2px solid rgba(212,175,55,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                animation: "pulse 3s ease-in-out infinite",
              }}
            >
              <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--gold-300)", letterSpacing: "0.1em" }}>{modalityInfo?.icon || "FILE"}</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <p
                className="font-display"
                style={{
                  fontSize: 12,
                  color: "var(--text-80)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Upload {modalityInfo?.label} Scan
              </p>
              <p className="font-body" style={{ fontSize: 11, color: "var(--text-30)" }}>
                Drop files here or click to browse
              </p>
            </div>
            <button
              className="btn-gold"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              style={{ padding: "8px 20px", fontSize: 11 }}
            >
              Browse Files
            </button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={getUploadAcceptTypes(current.modality, { pro2dOnly })}
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
      </div>

      {/* ── Navigation ── */}
      <div
        className="glass-panel"
        style={{
          borderRadius: "0 0 var(--r-md) var(--r-md)",
          borderTop: "none",
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          className="btn-ghost"
          onClick={handlePrev}
          style={{
            padding: "6px 16px",
            fontSize: 11,
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--r-sm)",
          }}
        >
          ← {currentStep === 0 ? "Back to Selection" : "Previous"}
        </button>

        <button
          className={current.uploaded ? "btn-gold" : "btn-ghost"}
          onClick={handleNext}
          disabled={!current.uploaded}
          style={{
            padding: "6px 20px",
            fontSize: 11,
            opacity: current.uploaded ? 1 : 0.4,
            cursor: current.uploaded ? "pointer" : "not-allowed",
            border: current.uploaded ? "none" : "1px solid var(--glass-border)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {isLast
            ? allUploaded
              ? "✦ Proceed to Analysis"
              : "Complete Uploads First"
            : `Next: ${MODALITIES.find((m) => m.id === uploads[currentStep + 1]?.modality)?.label || ""} →`}
        </button>
      </div>
    </div>
  );
}
