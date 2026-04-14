"use client";

import React from "react";
import type { AIInterpretationReport } from "@/lib/analyse/types";
import type { ReportEnginePhase } from "@/hooks/analyse/useReportEngineLaunch";
import { AI_DYNAMIC_SECTIONS_ENABLED } from "@/lib/analyse/constants";

interface Props {
  report: AIInterpretationReport;
  webSearchEnabled?: boolean;
  onNewScan?: () => void;
  reportEngine?: {
    phase: ReportEnginePhase;
    statusLine: string;
    onPrimaryClick: () => void;
  };
}

const E = {
  bgCard: "#0a1520",
  bgDeep: "#060d14",
  border: "rgba(0,180,255,0.18)",
  borderSubtle: "rgba(0,180,255,0.08)",
  textPrimary: "#e8f4ff",
  textSecondary: "#7ab3cc",
  textMuted: "#3d6678",
  label: "#4a8fa8",
  cyan: "#00d4ff",
  teal: "#00ffcc",
  amber: "#ffb840",
  green: "#00e87a",
  red: "#ff4d6a",
} as const;

function severityBannerStyle(level: string): React.CSSProperties {
  switch (level) {
    case "critical":
      return {
        background: "linear-gradient(135deg, rgba(255,45,80,0.12), rgba(180,20,50,0.06))",
        border: "1px solid rgba(255,45,80,0.35)",
        borderLeft: "4px solid #ff2244",
      };
    case "urgent":
      return {
        background: "linear-gradient(135deg, rgba(255,140,0,0.1), rgba(80,40,0,0.05))",
        border: "1px solid rgba(255,180,80,0.35)",
        borderLeft: "4px solid #ff8c00",
      };
    case "moderate":
      return {
        background: "linear-gradient(135deg, rgba(0,150,200,0.1), rgba(0,60,100,0.05))",
        border: "1px solid rgba(0,180,255,0.22)",
        borderLeft: "4px solid #ffd700",
      };
    default:
      return {
        background: "linear-gradient(135deg, rgba(0,232,122,0.08), rgba(0,60,80,0.04))",
        border: "1px solid rgba(0,232,122,0.22)",
        borderLeft: "4px solid #00e87a",
      };
  }
}

function sectionHeader(num: string, title: string) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: `1px solid ${E.borderSubtle}`,
      }}
    >
      <span
        style={{
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 10,
          color: E.cyan,
          opacity: 0.65,
          letterSpacing: "0.06em",
        }}
      >
        {num}
      </span>
      <span
        style={{
          fontFamily: "'Syne', system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: E.textSecondary,
          flex: 1,
        }}
      >
        {title}
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background: "linear-gradient(90deg, rgba(0,180,255,0.25), transparent)",
          minWidth: 24,
        }}
      />
    </div>
  );
}

function emphasisBorder(emph?: string): string {
  switch (emph) {
    case "clinical":
      return "rgba(255,184,64,0.45)";
    case "technical":
      return "rgba(0,255,204,0.35)";
    default:
      return "rgba(0,212,255,0.35)";
  }
}

export default function AIReportPanel({
  report,
  webSearchEnabled,
  onNewScan,
  reportEngine,
}: Props) {
  const sev = report.severity?.level || "incidental";
  const imp = report.impressions;
  const re = reportEngine;
  const connecting = re?.phase === "connecting";
  const ready = re?.phase === "ready";

  const dynamicSections =
    AI_DYNAMIC_SECTIONS_ENABLED && report.dynamic_sections?.length
      ? report.dynamic_sections.slice(0, 5)
      : [];

  const cc = report.clinical_correlation;
  const hasClinicalCorrelation =
    cc &&
    (Boolean(cc.supports_history?.trim()) ||
      Boolean(cc.contradicts_history?.trim()) ||
      Boolean(cc.additional_context_needed?.trim()));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        overflowY: "auto",
        maxHeight: "100%",
        padding: 20,
        borderRadius: 12,
        border: `1px solid ${E.border}`,
        background: E.bgCard,
        color: E.textPrimary,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          borderRadius: 10,
          padding: "14px 16px",
          ...severityBannerStyle(sev),
        }}
      >
        <div
          style={{
            fontFamily: "'Syne', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: E.textPrimary,
          }}
        >
          {sev} · {report.severity?.time_sensitivity}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: E.textSecondary }}>
          {report.severity?.triage_action}
        </div>
      </div>

      <section>
        {sectionHeader("§01", "Findings")}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {(report.findings?.primary ?? []).map((f, i) => (
            <li
              key={`p-${i}`}
              style={{
                borderRadius: 10,
                border: `1px solid ${E.borderSubtle}`,
                background: E.bgDeep,
                padding: "14px 16px",
                borderLeft: "3px solid rgba(0,212,255,0.5)",
                fontSize: 13,
                lineHeight: 1.65,
                color: E.textSecondary,
              }}
            >
              <strong style={{ color: E.textPrimary }}>{f.location}</strong>: {f.description}
              {f.measurement ? <span style={{ color: E.textMuted }}> ({f.measurement})</span> : null}
              <div style={{ marginTop: 6, fontSize: 12, color: E.textMuted }}>{f.significance}</div>
            </li>
          ))}
          {(report.findings?.secondary ?? []).map((f, i) => (
            <li
              key={`s-${i}`}
              style={{
                borderRadius: 10,
                border: `1px solid ${E.borderSubtle}`,
                background: E.bgDeep,
                padding: "12px 14px",
                fontSize: 12,
                lineHeight: 1.6,
                color: E.textSecondary,
              }}
            >
              <strong style={{ color: E.textPrimary }}>{f.location}</strong>: {f.description}
              <div style={{ marginTop: 4, fontSize: 11, color: E.textMuted }}>{f.significance}</div>
            </li>
          ))}
        </ul>
        {(report.findings?.negative_pertinents?.length ?? 0) > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(report.findings?.negative_pertinents ?? []).map((n, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: `1px solid ${E.border}`,
                  color: E.textMuted,
                }}
              >
                {n}
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        {sectionHeader("§02", "Impressions")}
        {imp?.primary_diagnosis && (
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 12,
              border: `1px solid rgba(0,220,255,0.35)`,
              background: "linear-gradient(135deg, rgba(0,100,160,0.15), rgba(0,60,100,0.08))",
              padding: "22px 24px",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: "linear-gradient(90deg, #00d4ff, #00ffcc, #00d4ff)",
                backgroundSize: "200% 100%",
                animation: "aiReportShimmer 3s ease-in-out infinite",
              }}
            />
            <div
              style={{
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: E.cyan,
                marginBottom: 10,
              }}
            >
              Primary diagnosis
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 18,
                  fontWeight: 700,
                  color: E.textPrimary,
                }}
              >
                {imp.primary_diagnosis.name}
              </span>
              {imp.primary_diagnosis.icd10 ? (
                <span
                  style={{
                    fontFamily: "'DM Mono', ui-monospace, monospace",
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "rgba(0,0,0,0.35)",
                    border: `1px solid ${E.borderSubtle}`,
                  }}
                >
                  {imp.primary_diagnosis.icd10}
                </span>
              ) : null}
              <span style={{ fontSize: 12, color: E.textMuted }}>{imp.primary_diagnosis.confidence_pct}%</span>
            </div>
            {imp.primary_diagnosis.evidence ? (
              <p style={{ margin: 0, fontSize: 12, color: E.textMuted, lineHeight: 1.55 }}>
                {imp.primary_diagnosis.evidence}
              </p>
            ) : null}
          </div>
        )}

        <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0 }}>
          {(imp?.differentials ?? []).map((d, i) => (
            <li
              key={i}
              style={{
                padding: "10px 0",
                borderBottom: `1px solid ${E.borderSubtle}`,
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 11, color: E.textMuted, width: 22 }}>
                  {i + 2}
                </span>
                <span style={{ flex: 1, color: E.textPrimary, fontWeight: 500 }}>{d.name}</span>
                <span
                  style={{
                    width: 72,
                    height: 4,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, d.confidence_pct))}%`,
                      borderRadius: 4,
                      background: "linear-gradient(90deg, #00d4ff, #00ffcc)",
                    }}
                  />
                </span>
                <span
                  style={{
                    fontFamily: "'DM Mono', ui-monospace, monospace",
                    fontSize: 10,
                    color: E.cyan,
                    width: 36,
                    textAlign: "right",
                  }}
                >
                  {d.confidence_pct}%
                </span>
              </div>
              {d.reasoning ? (
                <p style={{ fontSize: 11, color: E.textMuted, margin: "6px 0 0 34px", lineHeight: 1.5 }}>{d.reasoning}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {hasClinicalCorrelation && cc ? (
        <section style={{ fontSize: 13, lineHeight: 1.65, color: E.textSecondary }}>
          {sectionHeader("§03", "Clinical correlation")}
          {cc.supports_history?.trim() ? <p style={{ margin: "0 0 8px" }}>{cc.supports_history}</p> : null}
          {cc.contradicts_history?.trim() ? (
            <p style={{ margin: "0 0 8px", color: E.amber }}>{cc.contradicts_history}</p>
          ) : null}
          {cc.additional_context_needed?.trim() ? (
            <p style={{ margin: 0, color: E.textMuted }}>{cc.additional_context_needed}</p>
          ) : null}
        </section>
      ) : null}

      <section>
        {sectionHeader("§04", "Next steps")}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {(report.next_steps ?? []).map((n, i) => (
            <div
              key={i}
              style={{
                borderRadius: 10,
                border: `1px solid ${E.borderSubtle}`,
                background: "#0d1c2a",
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 6 }}>
                {n.priority === "immediate" ? "🔴" : n.priority === "soon" ? "🟠" : "🟢"}
              </div>
              <div
                style={{
                  fontFamily: "'Syne', system-ui, sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: E.textPrimary,
                  marginBottom: 6,
                }}
              >
                {n.action}
              </div>
              <div style={{ fontSize: 11, color: E.textSecondary, lineHeight: 1.55 }}>{n.reasoning}</div>
            </div>
          ))}
        </div>
      </section>

      {dynamicSections.length > 0 ? (
        <section>
          {sectionHeader("§05", "Clinical intelligence")}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {dynamicSections.map((s) => (
              <div
                key={s.id}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${emphasisBorder(s.emphasis)}`,
                  background: E.bgDeep,
                  padding: "14px 16px",
                  borderLeft: `3px solid ${emphasisBorder(s.emphasis)}`,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Syne', system-ui, sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    color: E.textPrimary,
                    marginBottom: 8,
                  }}
                >
                  {s.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.7,
                    color: E.textSecondary,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {s.body}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {(report.research_references?.length ?? 0) > 0 && (
        <section>
          {sectionHeader(dynamicSections.length ? "§06" : "§05", `References${webSearchEnabled ? " (web)" : ""}`)}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {(report.research_references ?? []).map((r, i) => (
              <li key={i} style={{ fontSize: 13 }}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: E.cyan, textDecoration: "underline" }}>
                  {r.title}
                </a>{" "}
                <span style={{ fontSize: 11, color: E.textMuted }}>
                  {r.journal} {r.year}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.indian_clinical_notes ? (
        <section
          style={{
            borderRadius: 10,
            border: `1px solid ${E.borderSubtle}`,
            padding: 14,
            fontSize: 13,
            lineHeight: 1.6,
            color: E.textSecondary,
          }}
        >
          {sectionHeader("§07", "Regional notes")}
          <p style={{ margin: 0 }}>{report.indian_clinical_notes}</p>
        </section>
      ) : null}

      <footer
        style={{
          borderTop: `1px solid ${E.borderSubtle}`,
          paddingTop: 14,
          fontSize: 11,
          color: E.textMuted,
          lineHeight: 1.55,
        }}
      >
        {report.disclaimer}
        {report.models_used && report.models_used.length > 0 ? (
          <div style={{ marginTop: 8, fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 10, opacity: 0.75 }}>
            {report.models_used.join(" · ")}
          </div>
        ) : null}
      </footer>

      {re ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: `1px solid ${E.borderSubtle}`, paddingTop: 16 }}>
          {(connecting || ready) && re.statusLine ? (
            <p
              style={{
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 10,
                letterSpacing: "0.06em",
                color: connecting ? E.textMuted : E.teal,
                textTransform: connecting ? "uppercase" : "none",
                margin: 0,
              }}
            >
              {re.statusLine}
            </p>
          ) : null}
          <button
            type="button"
            disabled={connecting}
            onClick={re.onPrimaryClick}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              border: "none",
              cursor: connecting ? "not-allowed" : "pointer",
              opacity: connecting ? 0.55 : 1,
              background: "linear-gradient(135deg, #00d4ff, #00ffcc)",
              color: "#020509",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'Syne', system-ui, sans-serif",
              letterSpacing: "0.04em",
              boxShadow: "0 0 24px rgba(0,212,255,0.25)",
            }}
          >
            {connecting
              ? "Preparing Universal Report Engine…"
              : ready
                ? "Open Universal Report Engine"
                : "✦ Universal Report Engine"}
          </button>
        </div>
      ) : null}

      {onNewScan ? (
        <button
          type="button"
          onClick={onNewScan}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: `1px solid ${E.border}`,
            background: "transparent",
            color: E.textSecondary,
            fontSize: 13,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          New scan
        </button>
      ) : null}
    </div>
  );
}
