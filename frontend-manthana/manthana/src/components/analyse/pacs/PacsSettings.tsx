"use client";
/**
 * PacsSettings — PACS connection configuration panel
 * 
 * Shows Orthanc status, remote modalities, and connectivity testing.
 */
import React, { useEffect, useState, useCallback } from "react";
import type { PacsConfig } from "@/lib/analyse/types";
import { getPacsConfig, echoPacs } from "@/lib/analyse/api";

interface Props {
  className?: string;
}

export default function PacsSettings({ className }: Props) {
  const [config, setConfig] = useState<PacsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [echoResults, setEchoResults] = useState<Record<string, string>>({});

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPacsConfig();
      setConfig(data);
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleEcho = async (name: string) => {
    setEchoResults((prev) => ({ ...prev, [name]: "testing..." }));
    try {
      const result = await echoPacs(name);
      setEchoResults((prev) => ({ ...prev, [name]: result.status === "ok" ? "✅ Connected" : "❌ Failed" }));
    } catch {
      setEchoResults((prev) => ({ ...prev, [name]: "❌ Failed" }));
    }
  };

  return (
    <div className={`pacs-settings ${className || ""}`}>
      {/* ─── Header ─── */}
      <div className="pacs-browser-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚙️</span>
          <h3 className="font-display" style={{ fontSize: 13, margin: 0, color: "var(--text-100)", letterSpacing: "0.05em" }}>
            PACS SETTINGS
          </h3>
        </div>
        <button
          onClick={loadConfig}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 4 }}
          title="Refresh"
        >
          🔄
        </button>
      </div>

      {loading ? (
        <div className="pacs-empty-state">
          <div className="pacs-spinner" />
          <p className="font-mono" style={{ fontSize: 10, color: "var(--text-30, #555)" }}>
            Connecting to Orthanc...
          </p>
        </div>
      ) : !config ? (
        <div className="pacs-empty-state">
          <span style={{ fontSize: 24 }}>🔌</span>
          <p className="font-body" style={{ fontSize: 11, color: "#EF5350" }}>
            Orthanc PACS is not reachable
          </p>
          <p className="font-mono" style={{ fontSize: 9, color: "var(--text-30, #555)", textAlign: "center" }}>
            Ensure Orthanc is running and the PACS Bridge service is started
          </p>
          <button onClick={loadConfig} className="pacs-retry-btn" style={{ marginTop: 8 }}>Retry</button>
        </div>
      ) : (
        <div className="pacs-settings-content">
          {/* ─── Server Info ─── */}
          <div className="pacs-settings-section">
            <h4 className="font-display" style={{ fontSize: 11, color: "var(--scan-300, #5EEDDB)", marginBottom: 8, letterSpacing: "0.08em" }}>
              SERVER
            </h4>
            <div className="pacs-settings-grid">
              <div className="pacs-settings-item">
                <span className="pacs-settings-label font-mono">Status</span>
                <span className="pacs-settings-value font-mono" style={{ color: "#66BB6A" }}>
                  ● Connected
                </span>
              </div>
              <div className="pacs-settings-item">
                <span className="pacs-settings-label font-mono">Version</span>
                <span className="pacs-settings-value font-mono">{config.orthanc_version}</span>
              </div>
              <div className="pacs-settings-item">
                <span className="pacs-settings-label font-mono">AE Title</span>
                <span className="pacs-settings-value font-mono">{config.dicom_aet}</span>
              </div>
              <div className="pacs-settings-item">
                <span className="pacs-settings-label font-mono">DICOM Port</span>
                <span className="pacs-settings-value font-mono">{config.dicom_port}</span>
              </div>
              <div className="pacs-settings-item">
                <span className="pacs-settings-label font-mono">Plugins</span>
                <span className="pacs-settings-value font-mono" style={{ fontSize: 8 }}>
                  {config.plugins?.join(", ") || "None"}
                </span>
              </div>
            </div>
          </div>

          {/* ─── Remote Modalities ─── */}
          <div className="pacs-settings-section">
            <h4 className="font-display" style={{ fontSize: 11, color: "var(--scan-300, #5EEDDB)", marginBottom: 8, letterSpacing: "0.08em" }}>
              REMOTE MODALITIES
            </h4>
            {config.modalities && Object.keys(config.modalities).length > 0 ? (
              Object.entries(config.modalities).map(([name, details]) => (
                <div key={name} className="pacs-modality-row">
                  <div style={{ flex: 1 }}>
                    <span className="font-display" style={{ fontSize: 11, color: "var(--text-100)" }}>
                      {name}
                    </span>
                    <span className="font-mono" style={{ fontSize: 9, color: "var(--text-30, #555)", marginLeft: 8 }}>
                      {Array.isArray(details) ? details.slice(0, 3).join(" · ") : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {echoResults[name] && (
                      <span className="font-mono" style={{ fontSize: 9, color: echoResults[name].includes("✅") ? "#66BB6A" : "#EF5350" }}>
                        {echoResults[name]}
                      </span>
                    )}
                    <button
                      onClick={() => handleEcho(name)}
                      className="pacs-echo-btn"
                      title="Test connectivity (C-ECHO)"
                    >
                      🔗 Test
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="font-mono" style={{ fontSize: 10, color: "var(--text-30, #555)", textAlign: "center", padding: "12px 0" }}>
                No remote modalities configured.<br />
                Add hospital PACS via Orthanc Explorer or API.
              </p>
            )}
          </div>

          {/* ─── Quick Guide ─── */}
          <div className="pacs-settings-section">
            <h4 className="font-display" style={{ fontSize: 11, color: "var(--scan-300, #5EEDDB)", marginBottom: 8, letterSpacing: "0.08em" }}>
              QUICK GUIDE
            </h4>
            <div className="font-body" style={{ fontSize: 10, color: "var(--text-55, #888)", lineHeight: 1.6 }}>
              <p>📡 <strong>Receive studies:</strong> Configure hospital PACS to send (C-STORE) to AET <code>{config.dicom_aet}</code> on port <code>{config.dicom_port}</code></p>
              <p>🔍 <strong>Query remote:</strong> Add modalities via Orthanc config, then use C-FIND to search</p>
              <p>🤖 <strong>Auto-analysis:</strong> Incoming studies are automatically sent for AI analysis after 60 seconds of stability</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
