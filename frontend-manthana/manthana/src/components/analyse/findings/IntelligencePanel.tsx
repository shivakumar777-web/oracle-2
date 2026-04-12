"use client";
import React, { useMemo, useCallback, useEffect, useState } from "react";
import type { AnalysisResponse, ScanStage, HeatmapState } from "@/lib/analyse/types";
import FindingCard from "./FindingCard";
import DualArcGauge from "./DualArcGauge";
import { MODALITIES } from "@/lib/analyse/constants";
import { modalityBarIdFromBackendCt } from "@/lib/analyse/ct-upload-wizard";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";
import { scoreFindings } from "@/lib/analyse/structured-reports";
import { uniqueFormattedLabsModels } from "@/lib/analyse/display-models";

interface Props {
  stage: ScanStage;
  result: AnalysisResponse | null;
  detectedModality?: string;
  onGenerateReport?: () => void;
  onNewScan?: () => void;
  onAskAI?: () => void;
  heatmapState?: HeatmapState;
  onHeatmapStateChange?: (state: HeatmapState) => void;
  /** Optional elapsed analysis time in ms for the active image. */
  analysisElapsedMs?: number;
  /** Optional retry handler for failed analyses. */
  onRetry?: () => void;
  /** MedGemma chest Q&A step (after TXRV, before Kimi final report). */
  medgemmaQa?: {
    questions: Array<{ id: string; question: string; why_needed?: string }>;
    impressionDraft?: string;
    onSubmit: (answers: Record<string, string>) => void;
    onSkipAll: () => void;
  };
}

export default function IntelligencePanel({
  stage,
  result,
  detectedModality,
  onGenerateReport,
  onNewScan,
  onAskAI,
  heatmapState,
  onHeatmapStateChange,
  analysisElapsedMs,
  onRetry,
  medgemmaQa,
}: Props) {
  const { isMobile, isTablet } = useMediaQuery();
  const compact = isMobile || isTablet;
  const isIdle = stage === "idle";
  const isScanning = !["idle", "complete", "error", "medgemma_questions"].includes(stage);
  const isComplete = stage === "complete" && result;

  const [medgemmaAnswers, setMedgemmaAnswers] = useState<Record<string, string>>({});
  const medgemmaQKey =
    medgemmaQa?.questions?.map((q) => q.id).join("\u001f") ?? "";

  useEffect(() => {
    if (!medgemmaQa?.questions?.length) {
      setMedgemmaAnswers({});
      return;
    }
    const init: Record<string, string> = {};
    for (const q of medgemmaQa.questions) {
      if (q.id) init[q.id] = "";
    }
    setMedgemmaAnswers(init);
  }, [medgemmaQKey]);

  const modalityInfo = useMemo(() => {
    const id = detectedModality || result?.modality || "";
    const direct = MODALITIES.find((m) => m.id === id);
    if (direct) return direct;
    if (id === "mri") {
      return MODALITIES.find((m) => m.id === "brain_mri");
    }
    if (id === "spine_neuro") {
      return MODALITIES.find((m) => m.id === "spine_mri") ?? MODALITIES.find((m) => m.id === "ct_spine");
    }
    const barId = modalityBarIdFromBackendCt(id);
    if (barId) {
      const mapped = MODALITIES.find((m) => m.id === barId);
      if (mapped) return mapped;
    }
    if (id === "ct" || id.endsWith("_ct")) {
      return MODALITIES.find((m) => m.id === "ct_abdomen");
    }
    return undefined;
  }, [detectedModality, result?.modality]);

  // Calculate overall confidence from findings
  const avgConfidence = result?.findings?.length
    ? Math.round(
        result.findings.reduce((sum, f) => sum + f.confidence, 0) /
          result.findings.length
      )
    : 0;

  // Compute RADS classification
  const radsScore = useMemo(() => {
    if (!result?.findings?.length || !result?.modality) return null;
    return scoreFindings(result.modality, result.findings);
  }, [result]);

  // Heatmap toggle for a specific finding
  const toggleFindingHeatmap = useCallback(
    (index: number) => {
      if (!onHeatmapStateChange || !heatmapState) return;
      if (heatmapState.activeFindingIndex === index) {
        // Deselect: show aggregate
        onHeatmapStateChange({ ...heatmapState, activeFindingIndex: null, visible: true });
      } else {
        onHeatmapStateChange({ ...heatmapState, activeFindingIndex: index, visible: true });
      }
    },
    [heatmapState, onHeatmapStateChange]
  );

  const toggleHeatmapMaster = useCallback(() => {
    if (!onHeatmapStateChange || !heatmapState) return;
    onHeatmapStateChange({ ...heatmapState, visible: !heatmapState.visible });
  }, [heatmapState, onHeatmapStateChange]);

  return (
    <div
      className={compact ? "intelligence-section" : "intelligence-section glass-panel"}
      style={{
        width: "100%",
        maxWidth: compact ? "none" : 380,
        flexShrink: 0,
        flex: compact ? 1 : undefined,
        minHeight: compact ? "calc(100dvh - 40px)" : undefined,
        display: "flex",
        flexDirection: "column",
        overflow: compact ? "visible" : "hidden",
        borderRadius: compact ? 0 : undefined,
        background: compact ? "transparent" : undefined,
        border: compact ? "none" : undefined,
        boxShadow: compact ? "none" : undefined,
      }}
    >
      {/* Panel header */}
      <div style={{ padding: "20px 20px 0" }}>
        <h2
          className="text-caption"
          style={{ color: "var(--text-30)", marginBottom: 16 }}
        >
          A N A L Y S I S &nbsp; F I N D I N G S
        </h2>
      </div>

      {/* ═══ IDLE STATE ═══ */}
      {isIdle && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            gap: 16,
          }}
        >
          <div style={{ opacity: 0.15, fontSize: 48 }}>◎</div>
          <p
            className="font-body"
            style={{
              fontSize: 13,
              fontStyle: "italic",
              color: "var(--text-30)",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            Upload a medical image to begin AI-powered analysis
          </p>
          <p
            className="font-display"
            style={{
              fontSize: 9,
              color: "var(--text-15)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            13 services · 23+ models ready
          </p>
        </div>
      )}

      {/* ═══ SCANNING STATE ═══ */}
      {isScanning && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            gap: 20,
          }}
        >
          {/* Scanning dots */}
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--scan-500)",
                  animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>

          <p
            className="text-caption"
            style={{ color: "var(--scan-400)", animation: "pulse 2s ease-in-out infinite" }}
          >
            {stage === "received" && "Processing image…"}
            {stage === "detecting" && "Detecting modality…"}
            {stage === "routing" && "Routing to AI model…"}
            {stage === "analyzing" && (modalityInfo?.id === "ct" || modalityInfo?.id?.startsWith("ct_")
              ? "CT segmentation running (60–120s)…"
              : modalityInfo?.id === "brain_mri" || modalityInfo?.id === "mri"
              ? "Brain MRI volumetrics in progress (90–180s)…"
              : modalityInfo?.id === "spine_mri" || modalityInfo?.id === "spine_neuro"
              ? "Spine MRI analysis running (60–90s)…"
              : modalityInfo?.id === "cardiac_ct"
              ? "Cardiac CT analysis in progress (60–120s)…"
              : "Running inference…")}
            {stage === "heatmap" && "Generating heatmap…"}
            {stage === "extracting" && "Extracting findings…"}
            {stage === "medgemma_finalizing" && "Writing final chest report (Kimi)…"}
          </p>

          {stage === "analyzing" && typeof analysisElapsedMs === "number" && analysisElapsedMs > 1000 && (
            <p
              className="font-mono"
              style={{ fontSize: 10, color: "var(--text-30)" }}
            >
              {new Date(analysisElapsedMs).toISOString().substr(14, 5)} elapsed
            </p>
          )}

          {/* Show detected modality as it's found */}
          {detectedModality && stage !== "received" && stage !== "detecting" && (
            <div
              className="pill pill-teal"
              style={{ animation: "fadeIn 0.5s ease-out" }}
            >
              <span>{modalityInfo?.icon || "◎"}</span>
              <span>{modalityInfo?.label || detectedModality}</span>
            </div>
          )}

          {/* Models being used */}
          {modalityInfo && stage === "analyzing" && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                justifyContent: "center",
                animation: "fadeIn 0.5s ease-out",
              }}
            >
              {modalityInfo.models.map((m) => (
                <span
                  key={m}
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    color: "var(--text-30)",
                    padding: "3px 8px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "var(--r-full)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {stage === "medgemma_questions" && result && medgemmaQa && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: compact ? "0 8px 28px" : "0 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
          className="no-scrollbar"
        >
          <p
            className="text-caption"
            style={{ color: "var(--gold-400)", letterSpacing: "0.1em", margin: 0 }}
          >
            MEDGEMMA CHEST — FOLLOW-UP
          </p>
          <p className="font-body" style={{ fontSize: 12, color: "var(--text-55)", lineHeight: 1.55, margin: 0 }}>
            Answer what you can (or skip) so we can generate the final structured report. This step uses your
            patient context and the TorchXRayVision scores already computed.
          </p>
          {medgemmaQa.impressionDraft ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <p className="text-caption" style={{ color: "var(--text-30)", margin: "0 0 6px" }}>
                Model draft (not the final report)
              </p>
              <p className="font-body" style={{ fontSize: 11, color: "var(--text-70)", margin: 0, lineHeight: 1.5 }}>
                {medgemmaQa.impressionDraft}
              </p>
            </div>
          ) : null}
          {medgemmaQa.questions.map((q) => (
            <label key={q.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="font-body" style={{ fontSize: 12, color: "var(--text-80)", fontWeight: 600 }}>
                {q.question}
              </span>
              {q.why_needed ? (
                <span className="font-mono" style={{ fontSize: 9, color: "var(--text-30)", lineHeight: 1.4 }}>
                  {q.why_needed}
                </span>
              ) : null}
              <textarea
                value={medgemmaAnswers[q.id] ?? ""}
                onChange={(e) =>
                  setMedgemmaAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                rows={2}
                placeholder="Type an answer or leave blank to skip this item"
                style={{
                  width: "100%",
                  resize: "vertical",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--glass-border)",
                  background: "rgba(0,0,0,0.25)",
                  color: "var(--text-90)",
                  fontSize: 12,
                  padding: "8px 10px",
                }}
              />
            </label>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={() => medgemmaQa.onSkipAll()}>
              Skip all questions
            </button>
            <button type="button" className="btn-gold" onClick={() => medgemmaQa.onSubmit(medgemmaAnswers)}>
              Generate final report
            </button>
          </div>
        </div>
      )}

      {/* ═══ COMPLETE STATE ═══ */}
      {isComplete && result && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: compact ? "0 8px 32px" : "0 20px 20px",
            minHeight: compact ? 0 : undefined,
          }}
          className="no-scrollbar"
        >
          {(() => {
            if (!result?.structures) return null;
            const st = result.structures;
            if (typeof st !== "object" || Array.isArray(st)) return null;
            const sq = st.segmentation_quality as string | undefined;
            if (sq !== "full_3d" && sq !== "degraded" && sq !== "visual_only") {
              return null;
            }
            const n =
              typeof st.organ_structures_measured === "number"
                ? st.organ_structures_measured
                : null;
            const mismatch = Boolean(st.dicom_declared_mismatch);

            if (sq === "full_3d") {
              return (
                <div
                  style={{
                    marginBottom: 14,
                    padding: "10px 12px",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid rgba(48, 209, 88, 0.35)",
                    background: "rgba(48, 209, 88, 0.08)",
                    animation: "fadeIn 0.5s ease-out",
                  }}
                >
                  <p className="font-body" style={{ fontSize: 12, color: "var(--clear)", margin: 0, lineHeight: 1.5 }}>
                    <span aria-hidden>✓ </span>
                    Full volumetric analysis
                    {n != null && n > 0 ? ` — ${n} organ structures measured` : ""}.
                  </p>
                </div>
              );
            }

            const limitedMsg =
              sq === "visual_only"
                ? "Organ volume measurements require 80+ DICOM slices. This report emphasises visual assessment. For complete volumetric analysis, upload the full DICOM series from the CT workstation."
                : "Segmentation ran in standard (3 mm) mode; volume estimates may be approximate. For best volumetric accuracy, upload 80+ thin-slice DICOM files when available.";

            return (
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 12px",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid rgba(255, 193, 7, 0.35)",
                  background: "rgba(255, 193, 7, 0.08)",
                  animation: "fadeIn 0.5s ease-out",
                }}
              >
                <p className="font-body" style={{ fontSize: 12, color: "var(--warning)", margin: 0, lineHeight: 1.5 }}>
                  <span aria-hidden>⚠ </span>
                  Limited CT analysis — {limitedMsg}
                </p>
                {mismatch && (
                  <p
                    className="text-caption"
                    style={{ fontSize: 10, color: "var(--text-30)", margin: "8px 0 0", lineHeight: 1.45 }}
                  >
                    Fewer DICOM files were found in the upload than you indicated — results are based on what was
                    received.
                  </p>
                )}
              </div>
            );
          })()}

          {/* Verified badge + modality */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              animation: "fadeIn 0.5s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--gold-300)", fontSize: 14 }}>✦</span>
              <span
                className="text-caption"
                style={{ color: "var(--gold-300)", fontSize: 9 }}
              >
                MANTHANA VERIFIED
              </span>
            </div>
            {/* Heatmap toggle */}
            {heatmapState && onHeatmapStateChange && (
              <button
                onClick={toggleHeatmapMaster}
                title="Toggle AI Attention Map"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 10px",
                  borderRadius: "var(--r-full)",
                  border: heatmapState.visible
                    ? "1px solid rgba(0, 196, 176, 0.3)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background: heatmapState.visible
                    ? "rgba(0, 196, 176, 0.08)"
                    : "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  fontSize: 9,
                  color: heatmapState.visible ? "var(--scan-400)" : "var(--text-30)",
                }}
              >
                <span style={{ fontSize: 11 }}>🔥</span>
                <span className="font-display" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {heatmapState.visible ? "ON" : "OFF"}
                </span>
              </button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="pill pill-teal" style={{ padding: "3px 10px", fontSize: 9 }}>
                {modalityInfo?.icon} {modalityInfo?.label || result.modality}
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 10, color: "var(--text-30)" }}
              >
                {result.processing_time_sec}s
              </span>
            </div>
          </div>

          {/* Confidence gauge */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 20,
              animation: "fadeIn 0.8s ease-out",
            }}
          >
            <DualArcGauge aiConfidence={avgConfidence} size={110} />
          </div>

          {/* ═══ RADS CLASSIFICATION BADGE ═══ */}
          {radsScore && (
            <div
              style={{
                marginBottom: 16,
                padding: "14px 16px",
                borderRadius: "var(--r-sm)",
                background: radsScore.category.severity === "critical"
                  ? "var(--critical-bg)"
                  : radsScore.category.severity === "warning"
                  ? "var(--warning-bg)"
                  : radsScore.category.severity === "info"
                  ? "rgba(0,196,176,0.06)"
                  : "var(--clear-bg)",
                border: `1px solid ${
                  radsScore.category.severity === "critical"
                    ? "rgba(255,79,79,0.25)"
                    : radsScore.category.severity === "warning"
                    ? "rgba(255,196,57,0.25)"
                    : radsScore.category.severity === "info"
                    ? "rgba(0,196,176,0.2)"
                    : "rgba(46,204,113,0.2)"
                }`,
                animation: "fadeIn 0.6s ease-out",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span
                  className="font-display"
                  style={{
                    fontSize: 10,
                    color: "var(--text-30)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  {radsScore.standard} CLASSIFICATION
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 9, color: "var(--text-15)", fontStyle: "italic" }}
                >
                  {radsScore.version}
                </span>
              </div>
              {/* Category badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span
                  className="font-display"
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color:
                      radsScore.category.severity === "critical"
                        ? "var(--critical)"
                        : radsScore.category.severity === "warning"
                        ? "var(--warning)"
                        : radsScore.category.severity === "info"
                        ? "var(--scan-400)"
                        : "var(--clear)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {radsScore.category.code}
                </span>
                <div>
                  <p className="font-display" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-100)" }}>
                    {radsScore.category.label}
                  </p>
                  <p className="font-mono" style={{ fontSize: 9, color: "var(--text-30)" }}>
                    Risk: {radsScore.category.risk}
                  </p>
                </div>
              </div>
              {/* Recommendation */}
              <p
                className="font-body"
                style={{
                  fontSize: 11,
                  color: "var(--text-55)",
                  lineHeight: 1.6,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingTop: 8,
                  fontStyle: "italic",
                }}
              >
                ▸ {radsScore.category.recommendation}
              </p>
            </div>
          )}

          {/* Findings list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {result.findings.map((finding, i) => (
              <FindingCard
                key={i}
                finding={finding}
                index={i}
                isActive={heatmapState?.visible && heatmapState?.activeFindingIndex === i}
                onToggleHeatmap={onHeatmapStateChange ? () => toggleFindingHeatmap(i) : undefined}
                onClick={onHeatmapStateChange ? () => toggleFindingHeatmap(i) : undefined}
              />
            ))}
          </div>

          {/* Diamond separator */}
          <div className="diamond-sep">
            <span /><span /><span />
          </div>

          {/* Impression */}
          <div style={{ marginBottom: 20 }}>
            <h3
              className="text-caption"
              style={{ color: "var(--gold-500)", marginBottom: 8 }}
            >
              ✦ IMPRESSION
            </h3>
            <p
              className="font-body"
              style={{
                fontSize: 13,
                color: "var(--text-80)",
                fontStyle: "italic",
                lineHeight: 1.7,
              }}
            >
              {result.impression}
            </p>
          </div>

          {(() => {
            const st = result.structures;
            if (
              typeof st !== "object" ||
              st === null ||
              Array.isArray(st) ||
              typeof (st as Record<string, unknown>).narrative_report !== "string"
            ) {
              return null;
            }
            const nr = String((st as Record<string, unknown>).narrative_report).trim();
            if (!nr) return null;
            return (
              <div style={{ marginBottom: 20 }}>
                <h3
                  className="text-caption"
                  style={{ color: "var(--scan-400)", marginBottom: 8 }}
                >
                  ✦ FINAL INTERPRETATION (MedGemma + Kimi)
                </h3>
                <div
                  className="font-body"
                  style={{
                    fontSize: 12,
                    color: "var(--text-75)",
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {nr}
                </div>
              </div>
            );
          })()}

          {/* Models used */}
          {result.models_used?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p
                className="text-caption"
                style={{ color: "var(--text-15)", marginBottom: 6 }}
              >
                MODELS USED
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {uniqueFormattedLabsModels(result.models_used).map((m) => (
                  <span
                    key={m}
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      color: "var(--text-30)",
                      padding: "3px 8px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "var(--r-full)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ marginTop: "auto", paddingTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn-gold" onClick={onGenerateReport} style={{ width: "100%" }}>
              ✦ Generate Report
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-teal"
                onClick={onAskAI}
                style={{ flex: 1, fontSize: 10, padding: "8px 10px", lineHeight: 1.25 }}
              >
                Ask Manthana Oracle
              </button>
              <button
                className="btn-ghost"
                onClick={onNewScan}
                style={{
                  flex: 1,
                  border: "1px solid var(--glass-border)",
                  borderRadius: "var(--r-sm)",
                  padding: "8px 12px",
                  fontSize: 11,
                }}
              >
                ↻ New Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ERROR STATE ═══ */}
      {stage === "error" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            gap: 12,
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 14,
              fontWeight: 700,
              opacity: 0.4,
              color: "var(--warning)",
            }}
          >
            ERR
          </span>
          <p className="text-label" style={{ color: "var(--critical)" }}>
            Analysis Failed
          </p>
          <p
            className="font-body"
            style={{ fontSize: 12, color: "var(--text-30)", textAlign: "center" }}
          >
            The AI service could not process this image. Please retry. If the problem persists, check your connection or service status.
          </p>
          {onRetry && (
            <button className="btn-teal" onClick={onRetry} style={{ marginTop: 8 }}>
              ↻ Retry
            </button>
          )}
          {onNewScan && (
            <button
              className="btn-ghost"
              onClick={onNewScan}
              style={{ marginTop: 4, fontSize: 11 }}
            >
              New Scan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
