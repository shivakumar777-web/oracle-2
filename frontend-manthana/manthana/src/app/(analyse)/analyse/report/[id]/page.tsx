"use client";
import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import TopBar from "@/components/analyse/layout/TopBar";
import DisclaimerBar from "@/components/analyse/layout/DisclaimerBar";
import { getEntries } from "@/lib/analyse/history";
import { scoreFindings, getRADSDefinition } from "@/lib/analyse/structured-reports";
import type { Finding, Severity } from "@/lib/analyse/types";

/**
 * Report Viewer — Printable clinical report with RADS structured assessment
 */

const severityColors: Record<string, string> = {
  critical: "var(--critical)",
  warning: "var(--warning)",
  info: "var(--info)",
  clear: "var(--clear)",
};

// Fallback mock data when no real scan is found
const MOCK_FINDINGS: Finding[] = [
  {
    label: "Right lower lobe opacity",
    severity: "critical",
    confidence: 87,
    description: "Dense opacity in the right lower lobe consistent with consolidation, likely bacterial pneumonia.",
  },
  {
    label: "Cardiomegaly",
    severity: "warning",
    confidence: 62,
    description: "Mild enlargement of the cardiac silhouette. Cardiothoracic ratio approximately 0.55.",
  },
  {
    label: "Left lung clear",
    severity: "clear",
    confidence: 94,
    description: "No focal airspace opacity, pleural effusion, or pneumothorax in the left hemithorax.",
  },
];

export default function ReportPage() {
  const params = useParams();
  const reportId = params?.id as string;

  // Try loading from history; fall back to mock
  const historyEntry = useMemo(() => {
    if (!reportId) return null;
    const entries = getEntries();
    return entries.find((e) => e.id === reportId) || null;
  }, [reportId]);

  // Build structured data — history doesn't store full findings, use mock
  const modality = historyEntry?.modality || "xray";
  const findings: Finding[] = MOCK_FINDINGS;
  const impression =
    historyEntry?.impression ||
    "Right lower lobe opacity consistent with bacterial pneumonia. Mild cardiomegaly noted. No additional acute cardiopulmonary abnormality. Clinical correlation and follow-up imaging recommended.";
  const processingTime = "2.3s";
  const dateStr = historyEntry
    ? new Date(historyEntry.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  // RADS scoring
  const radsScore = useMemo(() => scoreFindings(modality, findings), [modality, findings]);
  const radsDef = useMemo(() => getRADSDefinition(modality), [modality]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <TopBar />

      <main
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "32px 16px",
          overflowY: "auto",
        }}
      >
        <div
          className="glass-panel"
          style={{
            width: "100%",
            maxWidth: 720,
            padding: "40px 40px 32px",
          }}
        >
          {/* Report Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1
              className="text-shimmer"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Manthana Radiologist Copilot
            </h1>
            <p className="text-caption" style={{ color: "var(--text-30)" }}>
              AI-ASSISTED STRUCTURED RADIOLOGY REPORT
            </p>
          </div>

          {/* Meta info */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              background: "var(--glass)",
              borderRadius: "var(--r-sm)",
              marginBottom: 32,
              fontFamily: "var(--font-display)",
              fontSize: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span style={{ color: "var(--text-55)" }}>
              <strong style={{ color: "var(--text-100)" }}>{modality.toUpperCase()}</strong>
            </span>
            <span style={{ color: "var(--text-30)" }}>{dateStr}</span>
            <span className="pill pill-teal" style={{ fontSize: 9, padding: "3px 10px" }}>
              {processingTime}
            </span>
          </div>

          {/* ═══ RADS CLASSIFICATION SECTION ═══ */}
          {radsScore && (
            <div
              style={{
                marginBottom: 32,
                padding: "20px 24px",
                borderRadius: "var(--r-sm)",
                background:
                  radsScore.category.severity === "critical"
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
              }}
            >
              {/* Standard header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span
                  className="font-display"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text-30)",
                  }}
                >
                  {radsScore.standard} CLASSIFICATION
                </span>
                <span className="font-mono" style={{ fontSize: 9, color: "var(--text-15)", fontStyle: "italic" }}>
                  {radsScore.version}
                </span>
              </div>

              {/* Big category badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <span
                  className="font-display"
                  style={{
                    fontSize: 32,
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
                  <p className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-100)", marginBottom: 2 }}>
                    {radsScore.category.label}
                  </p>
                  <p className="font-body" style={{ fontSize: 11, color: "var(--text-55)" }}>
                    {radsScore.category.description}
                  </p>
                  <p className="font-mono" style={{ fontSize: 10, color: "var(--text-30)", marginTop: 2 }}>
                    Malignancy / Abnormality Risk: {radsScore.category.risk}
                  </p>
                </div>
              </div>

              {/* Recommendation */}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  paddingTop: 12,
                }}
              >
                <p className="text-caption" style={{ color: "var(--gold-500)", marginBottom: 4, fontSize: 8 }}>
                  RECOMMENDATION
                </p>
                <p className="font-body" style={{ fontSize: 12, color: "var(--text-80)", lineHeight: 1.6 }}>
                  {radsScore.category.recommendation}
                </p>
              </div>

              {/* Scoring basis */}
              <p className="font-mono" style={{ fontSize: 9, color: "var(--text-15)", marginTop: 10, fontStyle: "italic" }}>
                {radsScore.scoringBasis}
              </p>
            </div>
          )}

          {/* ═══ STRUCTURED REPORT SECTIONS ═══ */}
          {radsScore?.sections && (
            <div style={{ marginBottom: 32 }}>
              {radsScore.sections.map((section, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <h3
                    className="text-caption"
                    style={{
                      color: i === 3 ? "var(--gold-500)" : i === 4 ? "var(--scan-400)" : "var(--text-30)",
                      marginBottom: 6,
                      fontSize: 9,
                    }}
                  >
                    {section.title.toUpperCase()}
                  </h3>
                  <p
                    className="font-body"
                    style={{
                      fontSize: 12,
                      color: "var(--text-60)",
                      lineHeight: 1.7,
                      whiteSpace: "pre-line",
                      paddingLeft: 12,
                      borderLeft: i === 3 ? "2px solid var(--gold-700)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {section.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Diamond separator */}
          <div className="diamond-sep">
            <span /><span /><span />
          </div>

          {/* Animated Timeline */}
          <div style={{ position: "relative", paddingLeft: 32, marginBottom: 32 }}>
            {/* Vertical line */}
            <div
              style={{
                position: "absolute",
                left: 8,
                top: 0,
                bottom: 0,
                width: 1,
                background: "linear-gradient(180deg, var(--scan-700), var(--gold-700), transparent)",
              }}
            />

            {findings.map((f, i) => (
              <div
                key={i}
                style={{
                  position: "relative",
                  marginBottom: 24,
                  animation: `slideInRight 0.4s ${i * 0.2}s var(--ease-out-expo) both`,
                }}
              >
                {/* Timeline dot */}
                <div
                  style={{
                    position: "absolute",
                    left: -28,
                    top: 6,
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: severityColors[f.severity],
                    boxShadow: `0 0 8px ${severityColors[f.severity]}`,
                  }}
                />

                {/* Finding card */}
                <div
                  style={{
                    padding: "12px 16px",
                    borderLeft: `3px solid ${severityColors[f.severity]}`,
                    background:
                      f.severity === "critical"
                        ? "var(--critical-bg)"
                        : f.severity === "warning"
                        ? "var(--warning-bg)"
                        : "var(--clear-bg)",
                    borderRadius: "var(--r-sm)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span
                      className="font-display"
                      style={{ fontSize: 13, fontWeight: 600, color: "var(--text-100)" }}
                    >
                      {f.label}
                    </span>
                    <span
                      className="font-mono"
                      style={{ fontSize: 11, color: severityColors[f.severity] }}
                    >
                      {f.confidence}%
                    </span>
                  </div>
                  <p
                    className="font-body"
                    style={{ fontSize: 12, color: "var(--text-55)", lineHeight: 1.6 }}
                  >
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Diamond separator */}
          <div className="diamond-sep">
            <span /><span /><span />
          </div>

          {/* Impression */}
          <div style={{ marginBottom: 32 }}>
            <h2 className="text-caption" style={{ color: "var(--gold-500)", marginBottom: 12 }}>
              ✦ IMPRESSION
            </h2>
            <p
              className="font-body"
              style={{
                fontSize: 14,
                color: "var(--text-80)",
                fontStyle: "italic",
                lineHeight: 1.8,
                borderLeft: "2px solid var(--gold-700)",
                paddingLeft: 16,
              }}
            >
              {impression}
            </p>
          </div>

          {/* RADS Category Reference Table */}
          {radsDef && (
            <div style={{ marginBottom: 32 }}>
              <h3 className="text-caption" style={{ color: "var(--text-30)", marginBottom: 10, fontSize: 9 }}>
                {radsDef.standard} REFERENCE — {radsDef.fullName}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {radsDef.categories.map((cat) => (
                  <div
                    key={cat.code}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 10px",
                      borderRadius: "var(--r-sm)",
                      background:
                        radsScore?.category.code === cat.code
                          ? "rgba(255,196,57,0.08)"
                          : "rgba(255,255,255,0.015)",
                      border:
                        radsScore?.category.code === cat.code
                          ? "1px solid rgba(255,196,57,0.2)"
                          : "1px solid transparent",
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        width: 48,
                        color: severityColors[cat.severity] || "var(--text-30)",
                      }}
                    >
                      {cat.code}
                    </span>
                    <span className="font-display" style={{ fontSize: 10, color: "var(--text-55)", flex: 1 }}>
                      {cat.label}
                    </span>
                    <span className="font-mono" style={{ fontSize: 9, color: "var(--text-20)" }}>
                      {cat.risk}
                    </span>
                    {radsScore?.category.code === cat.code && (
                      <span style={{ fontSize: 10 }}>◀</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn-gold" onClick={() => window.print()}>
              🖨 Print Report
            </button>
            <button className="btn-teal" onClick={() => window.history.back()}>
              ← Back to Scanner
            </button>
          </div>

          {/* Disclaimer footer */}
          <div
            style={{
              marginTop: 32,
              paddingTop: 16,
              borderTop: "1px solid var(--glass-border)",
              textAlign: "center",
            }}
          >
            <p
              className="font-display"
              style={{ fontSize: 9, color: "var(--text-15)", lineHeight: 1.6, letterSpacing: "0.04em" }}
            >
              This report is generated by Manthana Radiologist Copilot AI system for clinical decision
              support only. It is not a diagnostic instrument. All findings require verification by a
              qualified radiologist. Do not use as sole basis for diagnosis or treatment.
            </p>
          </div>
        </div>
      </main>

      <DisclaimerBar />
    </div>
  );
}
