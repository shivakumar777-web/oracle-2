"use client";
/**
 * PacsBrowser — Study list from Orthanc PACS
 * 
 * Searchable, filterable table of DICOM studies stored in Orthanc.
 * Allows sending studies to AI analysis pipeline.
 */
import React, { useEffect, useState, useCallback } from "react";
import type { PacsStudy } from "@/lib/analyse/types";
import { fetchPacsStudies, sendStudyToAI } from "@/lib/analyse/api";

interface Props {
  onStudySelect?: (study: PacsStudy) => void;
  className?: string;
}

const MODALITY_ICONS: Record<string, string> = {
  CR: "🩻", DX: "🩻", CT: "🔬", MR: "🧲", US: "📡",
  MG: "🎗️", NM: "☢️", PT: "☢️", ECG: "💓", XA: "💉",
  SM: "🔬", IO: "🦷", OPG: "🦷", PX: "🦷",
};

const AI_STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#FFA726" },
  queued: { label: "Queued", color: "#42A5F5" },
  analyzing: { label: "Analyzing", color: "#AB47BC" },
  complete: { label: "Complete", color: "#66BB6A" },
  failed: { label: "Failed", color: "#EF5350" },
};

export default function PacsBrowser({ onStudySelect, className }: Props) {
  const [studies, setStudies] = useState<PacsStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalityFilter, setModalityFilter] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadStudies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPacsStudies({
        patient_name: searchQuery || undefined,
        modality: modalityFilter || undefined,
        limit: 100,
      });
      setStudies(data);
    } catch (err: any) {
      setError(err.message || "Failed to load studies from PACS");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, modalityFilter]);

  useEffect(() => {
    loadStudies();
    const interval = setInterval(loadStudies, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [loadStudies]);

  const handleSendToAI = async (study: PacsStudy) => {
    setSendingId(study.orthanc_id);
    try {
      await sendStudyToAI(study.orthanc_id);
      await loadStudies(); // Refresh to show updated status
    } catch (err: any) {
      alert(`Failed to send study: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr || "—";
    return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
  };

  return (
    <div className={`pacs-browser ${className || ""}`}>
      {/* ─── Header ─── */}
      <div className="pacs-browser-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🗄️</span>
          <h3 className="font-display" style={{ fontSize: 13, margin: 0, color: "var(--text-100)", letterSpacing: "0.05em" }}>
            PACS STUDIES
          </h3>
          <span className="font-mono" style={{ fontSize: 9, color: "var(--text-55)", marginLeft: 4 }}>
            {studies.length} studies
          </span>
        </div>
        <button
          onClick={loadStudies}
          className="pacs-refresh-btn"
          title="Refresh"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 4 }}
        >
          🔄
        </button>
      </div>

      {/* ─── Search & Filter ─── */}
      <div className="pacs-filters">
        <input
          type="text"
          placeholder="Search patient name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pacs-search-input"
          onKeyDown={(e) => e.key === "Enter" && loadStudies()}
        />
        <select
          value={modalityFilter}
          onChange={(e) => setModalityFilter(e.target.value)}
          className="pacs-modality-select"
        >
          <option value="">All Modalities</option>
          <option value="CR">X-Ray (CR/DX)</option>
          <option value="CT">CT</option>
          <option value="MR">MRI</option>
          <option value="US">Ultrasound</option>
          <option value="MG">Mammography</option>
          <option value="NM">Nuclear</option>
        </select>
      </div>

      {/* ─── Study List ─── */}
      <div className="pacs-study-list">
        {loading && studies.length === 0 ? (
          <div className="pacs-empty-state">
            <div className="pacs-spinner" />
            <p className="font-mono" style={{ fontSize: 10, color: "var(--text-55)" }}>
              Connecting to PACS...
            </p>
          </div>
        ) : error ? (
          <div className="pacs-empty-state">
            <span style={{ fontSize: 24 }}>⚠️</span>
            <p className="font-body" style={{ fontSize: 11, color: "#EF5350", textAlign: "center" }}>
              {error}
            </p>
            <button onClick={loadStudies} className="pacs-retry-btn">
              Retry
            </button>
          </div>
        ) : studies.length === 0 ? (
          <div className="pacs-empty-state">
            <span style={{ fontSize: 28 }}>📭</span>
            <p className="font-body" style={{ fontSize: 11, color: "var(--text-55, #888)" }}>
              No studies in PACS
            </p>
            <p className="font-mono" style={{ fontSize: 9, color: "var(--text-30, #555)" }}>
              Studies will appear when received via C-STORE or STOW-RS
            </p>
          </div>
        ) : (
          studies.map((study) => (
            <div
              key={study.orthanc_id}
              className="pacs-study-row"
              onClick={() => onStudySelect?.(study)}
            >
              <div className="pacs-study-icon">
                {MODALITY_ICONS[study.modality?.split("\\")[0] || ""] || "📋"}
              </div>
              <div className="pacs-study-info">
                <div className="pacs-study-patient font-display">
                  {study.patient_name?.replace(/\^/g, " ") || "Anonymous"}
                </div>
                <div className="pacs-study-meta font-mono">
                  {study.modality || "??"} · {study.study_description || "No description"} · {formatDate(study.study_date)}
                </div>
                <div className="pacs-study-counts font-mono">
                  {study.series_count} series · {study.instance_count} images
                  {study.institution && ` · ${study.institution}`}
                </div>
              </div>
              <div className="pacs-study-actions">
                {study.ai_status && AI_STATUS_BADGES[study.ai_status] ? (
                  <span
                    className="pacs-ai-badge"
                    style={{ color: AI_STATUS_BADGES[study.ai_status].color }}
                  >
                    {AI_STATUS_BADGES[study.ai_status].label}
                  </span>
                ) : (
                  <button
                    className="pacs-analyze-btn"
                    onClick={(e) => { e.stopPropagation(); handleSendToAI(study); }}
                    disabled={sendingId === study.orthanc_id}
                  >
                    {sendingId === study.orthanc_id ? "⏳" : "🤖"} Analyze
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
