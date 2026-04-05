"use client";
import React, { useState, useMemo } from "react";
import type { UnifiedAnalysisResult, MultiModelResult } from "@/lib/analyse/types";
import CorrelationCard from "@/components/analyse/analysis/CorrelationCard";
import { MODALITIES } from "@/lib/analyse/constants";
import DualArcGauge from "./DualArcGauge";
import { scoreFindings } from "@/lib/analyse/structured-reports";
import LanguageSelector, { getPersistedLanguage } from "@/components/analyse/shared/LanguageSelector";

interface Props {
  unifiedResult: UnifiedAnalysisResult;
  individualResults: MultiModelResult[];
  onGenerateReport?: (language: string) => void;
  onNewScan?: () => void;
  onAskAI?: () => void;
}

export default function UnifiedReportPanel({
  unifiedResult,
  individualResults,
  onGenerateReport,
  onNewScan,
  onAskAI,
}: Props) {
  const [expandedModality, setExpandedModality] = useState<string | null>(null);
  const [reportLang, setReportLang] = useState<string>(() => getPersistedLanguage());

  const toggleExpand = (modality: string) => {
    setExpandedModality(expandedModality === modality ? null : modality);
  };

  return (
    <div
      className="intelligence-section glass-panel"
      style={{
        width: "100%",
        maxWidth: 380,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2
            className="text-caption"
            style={{ color: "var(--gold-300)", fontSize: 9 }}
          >
            ✦ &nbsp; U N I F I E D &nbsp; C R O S S - M O D A L I T Y &nbsp; A N A L Y S I S
          </h2>
          {/* Language Selector */}
          <LanguageSelector
            value={reportLang}
            onChange={setReportLang}
          />
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
          {unifiedResult.modalities_analyzed.map((m) => {
            const info = MODALITIES.find((mod) => mod.id === m);
            return (
              <span
                key={m}
                className="pill pill-teal"
                style={{ padding: "2px 8px", fontSize: 8 }}
              >
                {info?.icon} · {info?.label || m}
              </span>
            );
          })}
        </div>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 20px 20px",
        }}
        className="no-scrollbar"
      >
        {/* Confidence gauge */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 20,
            animation: "fadeIn 0.8s ease-out",
          }}
        >
          <DualArcGauge
            aiConfidence={unifiedResult.confidence === "high" ? 92 : unifiedResult.confidence === "moderate" ? 72 : 55}
            size={100}
          />
        </div>

        {/* Verified badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 16,
            animation: "fadeIn 0.5s ease-out",
          }}
        >
          <span style={{ color: "var(--gold-300)", fontSize: 14 }}>✦</span>
          <span
            className="text-caption"
            style={{ color: "var(--gold-300)", fontSize: 9 }}
          >
            MANTHANA UNIFIED ANALYSIS
          </span>
          <span
            className="font-mono"
            style={{ fontSize: 9, color: "var(--text-30)", marginLeft: "auto" }}
          >
            {unifiedResult.processing_time_sec}s
          </span>
        </div>

        {/* ── Individual Modality Summaries (Accordion) ── */}
        <div style={{ marginBottom: 16 }}>
          <h3
            className="text-caption"
            style={{ color: "var(--text-30)", marginBottom: 8, fontSize: 8 }}
          >
            INDIVIDUAL MODALITY REPORTS
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {unifiedResult.individual_reports.map((report) => {
              const info = MODALITIES.find((m) => m.id === report.modality);
              const isExpanded = expandedModality === report.modality;
              const individual = individualResults.find((r) => r.modality === report.modality);

              return (
                <div
                  key={report.modality}
                  style={{
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "var(--r-sm)",
                    overflow: "hidden",
                    transition: "all 0.3s",
                  }}
                >
                  <button
                    onClick={() => toggleExpand(report.modality)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      background: isExpanded ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-display)",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-55)" }}>{info?.icon}</span>
                    <span style={{ fontSize: 10, color: "var(--text-80)", flex: 1 }}>
                      {info?.label || report.modality}
                    </span>
                    <span style={{ fontSize: 9, color: "var(--text-20)", transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "none" }}>▸</span>
                  </button>
                    {isExpanded && (
                    <div
                      style={{
                        padding: "8px 12px 12px",
                        borderTop: "1px solid rgba(255,255,255,0.03)",
                        animation: "fadeIn 0.2s ease-out",
                      }}
                    >
                      {/* RADS badge for this modality */}
                      {(() => {
                        const rads = individual ? scoreFindings(report.modality, individual.result.findings) : null;
                        if (!rads) return null;
                        return (
                          <div
                            style={{
                              padding: "6px 10px",
                              marginBottom: 8,
                              borderRadius: "var(--r-sm)",
                              background:
                                rads.category.severity === "critical" ? "var(--critical-bg)" :
                                rads.category.severity === "warning" ? "var(--warning-bg)" :
                                "rgba(0,196,176,0.04)",
                              border: `1px solid ${
                                rads.category.severity === "critical" ? "rgba(255,79,79,0.2)" :
                                rads.category.severity === "warning" ? "rgba(255,196,57,0.2)" :
                                "rgba(0,196,176,0.15)"
                              }`,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span
                                className="font-display"
                                style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color:
                                    rads.category.severity === "critical" ? "var(--critical)" :
                                    rads.category.severity === "warning" ? "var(--warning)" :
                                    "var(--scan-400)",
                                }}
                              >
                                {rads.category.code}
                              </span>
                              <span className="font-display" style={{ fontSize: 9, color: "var(--text-55)" }}>
                                {rads.standard} — {rads.category.label}
                              </span>
                            </div>
                            <p className="font-mono" style={{ fontSize: 8, color: "var(--text-30)", marginTop: 3 }}>
                              Risk: {rads.category.risk} · {rads.category.recommendation.substring(0, 60)}...
                            </p>
                          </div>
                        );
                      })()}

                      <p
                        className="font-body"
                        style={{ fontSize: 10, color: "var(--text-60)", lineHeight: 1.5, margin: "0 0 6px" }}
                      >
                        <strong style={{ color: "var(--text-40)" }}>Impression:</strong> {report.impression}
                      </p>
                      {individual && individual.result.findings.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
                          {individual.result.findings.map((f, fi) => (
                            <div
                              key={fi}
                              style={{
                                fontSize: 9,
                                color: "var(--text-40)",
                                padding: "3px 8px",
                                background: "rgba(255,255,255,0.02)",
                                borderRadius: "var(--r-sm)",
                                borderLeft: `2px solid ${
                                  f.severity === "critical" ? "var(--critical)" :
                                  f.severity === "warning" ? "var(--warning)" :
                                  f.severity === "clear" ? "var(--clear)" : "var(--info)"
                                }`,
                              }}
                            >
                              {f.label} — {f.confidence}%
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Diamond separator */}
        <div className="diamond-sep">
          <span /><span /><span />
        </div>

        {unifiedResult.correlations && unifiedResult.correlations.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3
              className="text-caption"
              style={{ color: "var(--gold-300)", marginBottom: 10, fontSize: 9 }}
            >
              ✦ LINKED CROSS-MODALITY PATTERNS
            </h3>
            {unifiedResult.correlations.map((c, idx) => (
              <CorrelationCard key={`${c.pattern}-${idx}`} correlation={c} />
            ))}
          </div>
        )}

        {/* ── Unified Diagnosis ── */}
        <div style={{ marginBottom: 16 }}>
          <h3
            className="text-caption"
            style={{ color: "var(--gold-500)", marginBottom: 8, fontSize: 9 }}
          >
            ✦ UNIFIED DIAGNOSIS
          </h3>
          <p
            className="font-body"
            style={{
              fontSize: 12,
              color: "var(--text-80)",
              fontStyle: "italic",
              lineHeight: 1.7,
            }}
          >
            {unifiedResult.unified_diagnosis}
          </p>
        </div>

        {/* ── Cross-Modality Correlations ── */}
        <div style={{ marginBottom: 16 }}>
          <h3
            className="text-caption"
            style={{ color: "var(--scan-400)", marginBottom: 8, fontSize: 9 }}
          >
            CROSS-MODALITY CORRELATIONS
          </h3>
          <p
            className="font-body"
            style={{ fontSize: 11, color: "var(--text-60)", lineHeight: 1.6 }}
          >
            {unifiedResult.cross_modality_correlations}
          </p>
        </div>

        {/* ── Risk Assessment ── */}
        <div style={{ marginBottom: 16 }}>
          <h3
            className="text-caption"
            style={{ color: "var(--warning)", marginBottom: 8, fontSize: 9 }}
          >
            RISK ASSESSMENT
          </h3>
          <p
            className="font-body"
            style={{ fontSize: 11, color: "var(--text-60)", lineHeight: 1.6 }}
          >
            {unifiedResult.risk_assessment}
          </p>
        </div>

        {/* ── Treatment Recommendations ── */}
        <div style={{ marginBottom: 16 }}>
          <h3
            className="text-caption"
            style={{ color: "var(--clear)", marginBottom: 8, fontSize: 9 }}
          >
            TREATMENT RECOMMENDATIONS
          </h3>
          <p
            className="font-body"
            style={{ fontSize: 11, color: "var(--text-60)", lineHeight: 1.6, whiteSpace: "pre-line" }}
          >
            {unifiedResult.treatment_recommendations}
          </p>
        </div>

        {/* ── Prognosis ── */}
        <div style={{ marginBottom: 16 }}>
          <h3
            className="text-caption"
            style={{ color: "var(--info)", marginBottom: 8, fontSize: 9 }}
          >
            PROGNOSIS
          </h3>
          <p
            className="font-body"
            style={{ fontSize: 11, color: "var(--text-60)", lineHeight: 1.6 }}
          >
            {unifiedResult.prognosis}
          </p>
        </div>

        {/* Models used */}
        {unifiedResult.models_used.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p
              className="text-caption"
              style={{ color: "var(--text-15)", marginBottom: 6, fontSize: 8 }}
            >
              MODELS USED
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {[...new Set(unifiedResult.models_used)].map((m) => (
                <span
                  key={m}
                  className="font-mono"
                  style={{
                    fontSize: 8,
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
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            className="btn-gold"
            onClick={() => onGenerateReport?.(reportLang)}
            style={{ width: "100%", fontSize: 12 }}
          >
            ✦ Generate Unified Report ({reportLang.toUpperCase()})
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-teal"
              onClick={onAskAI}
              style={{ flex: 1, fontSize: 11, padding: "8px 12px" }}
            >
              Ask AI
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
    </div>
  );
}
