"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/analyse/layout/TopBar";
import DisclaimerBar from "@/components/analyse/layout/DisclaimerBar";
import { getEntries, deleteEntry } from "@/lib/analyse/history";
import type { HistoryEntry } from "@/lib/analyse/history";

// ── Status config ──────────────────────────────────────────
const STATUS_CONFIG = {
  draft: {
    label: "DRAFT",
    icon: "✏️",
    color: "var(--text-30)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)",
  },
  scan_done: {
    label: "SCAN DONE",
    icon: "✅",
    color: "var(--scan-400)",
    bg: "rgba(0,196,176,0.06)",
    border: "rgba(0,196,176,0.18)",
  },
  report_generated: {
    label: "REPORT GENERATED",
    icon: "📋",
    color: "var(--gold-300)",
    bg: "rgba(255,196,57,0.06)",
    border: "rgba(255,196,57,0.18)",
  },
} as const;

const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--critical)",
  warning: "var(--warning)",
  info: "var(--info)",
  clear: "var(--clear)",
};

const MODALITY_ICONS: Record<string, string> = {
  xray: "🫁", chest: "🫁", mri: "🧠", brain: "🧠", brain_mri: "🧠", spine_mri: "🦴",
  ct: "🔬", cardiac: "💓", ecg: "💗", ultrasound: "〰",
  pathology: "🔭", derm: "🩺", auto: "◎",
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function modalityIcon(mod: string) {
  return MODALITY_ICONS[mod.toLowerCase()] ?? "◎";
}

export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEntries(getEntries());
    setLoaded(true);
  }, []);

  const handleDelete = (id: string) => {
    deleteEntry(id);
    setEntries(getEntries());
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <TopBar />

      <main style={{ flex: 1, padding: "32px 24px", overflowY: "auto" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>

          {/* ─── Header ─── */}
          <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <h1
                className="text-headline"
                style={{ color: "var(--text-100)", marginBottom: 4 }}
              >
                Case History
              </h1>
              <p className="font-body" style={{ color: "var(--text-30)", fontSize: 13, fontStyle: "italic" }}>
                All scans — drafts, completed analyses, and generated reports
              </p>
            </div>
            <button
              className="btn-teal"
              style={{ fontSize: 12, padding: "8px 16px" }}
              onClick={() => router.push("/analyse")}
            >
              + New Scan
            </button>
          </div>

          {/* ─── Status legend ─── */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((s) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <span
                  key={s}
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    padding: "3px 10px",
                    borderRadius: "var(--r-full)",
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    color: cfg.color,
                    letterSpacing: "0.08em",
                  }}
                >
                  {cfg.icon} {cfg.label}
                </span>
              );
            })}
          </div>

          {/* ─── Empty state ─── */}
          {loaded && entries.length === 0 && (
            <div
              className="glass-panel"
              style={{
                padding: 48,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span style={{ fontSize: 48, opacity: 0.2 }}>📂</span>
              <p className="font-display" style={{ fontSize: 14, color: "var(--text-30)" }}>
                No cases yet
              </p>
              <p className="font-body" style={{ fontSize: 12, color: "var(--text-15)", fontStyle: "italic" }}>
                Upload a scan on the main page — it will appear here automatically
              </p>
              <button
                className="btn-teal"
                style={{ marginTop: 8, fontSize: 12, padding: "8px 20px" }}
                onClick={() => router.push("/analyse")}
              >
                Start a scan
              </button>
            </div>
          )}

          {/* ─── Case list ─── */}
          <div className="stagger-rise" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {entries.map((entry) => {
              const cfg = STATUS_CONFIG[entry.status];
              const sevColor = entry.severity ? SEVERITY_COLORS[entry.severity] : "var(--text-15)";

              return (
                <div
                  key={entry.id}
                  className="glass-panel"
                  style={{
                    padding: "14px 18px",
                    cursor: "default",
                    transition: "all var(--dur-normal) var(--ease-out-expo)",
                    borderLeft: `3px solid ${entry.status === "draft" ? "rgba(255,255,255,0.1)" : sevColor}`,
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--glass-hover)";
                    (e.currentTarget as HTMLElement).style.transform = "translateX(3px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "";
                    (e.currentTarget as HTMLElement).style.transform = "";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    {/* Left: icon + info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 28, flexShrink: 0 }}>{modalityIcon(entry.modality)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <p className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-100)" }}>
                            {entry.modality.toUpperCase()}
                          </p>
                          {/* Status badge */}
                          <span
                            className="font-mono"
                            style={{
                              fontSize: 9,
                              padding: "2px 8px",
                              borderRadius: "var(--r-full)",
                              background: cfg.bg,
                              border: `1px solid ${cfg.border}`,
                              color: cfg.color,
                              letterSpacing: "0.06em",
                              flexShrink: 0,
                            }}
                          >
                            {cfg.icon} {cfg.label}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 3, flexWrap: "wrap" }}>
                          <span className="font-mono" style={{ fontSize: 10, color: "var(--text-30)" }}>
                            {formatTime(entry.timestamp)}
                          </span>
                          <span className="font-mono" style={{ fontSize: 10, color: "var(--text-30)" }}>
                            {entry.patientId}
                          </span>
                          <span className="font-mono" style={{ fontSize: 10, color: "var(--text-15)" }}>
                            {entry.imageCount} image{entry.imageCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: findings count + delete */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                      {entry.findingsCount > 0 && (
                        <p className="font-display" style={{ fontSize: 11, color: sevColor }}>
                          {entry.findingsCount} finding{entry.findingsCount !== 1 ? "s" : ""}
                        </p>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Remove this case from history?")) handleDelete(entry.id);
                        }}
                        title="Remove"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                          opacity: 0.25,
                          color: "var(--text-100)",
                          transition: "opacity 0.15s",
                          padding: "2px 4px",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.25"; }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Impression (scan_done / report_generated only) */}
                  {entry.impression && (
                    <p
                      className="font-body"
                      style={{
                        fontSize: 12,
                        color: "var(--text-55)",
                        marginTop: 10,
                        fontStyle: "italic",
                        lineHeight: 1.5,
                        paddingLeft: 40,
                      }}
                    >
                      {entry.impression}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          {loaded && entries.length > 0 && (
            <div style={{ textAlign: "center", marginTop: 40 }}>
              <p className="font-display" style={{ fontSize: 10, color: "var(--text-15)", letterSpacing: "0.08em" }}>
                STORED LOCALLY ON THIS DEVICE · {entries.length} case{entries.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </main>

      <DisclaimerBar />
    </div>
  );
}
