"use client";
/**
 * WorklistPanel — Scheduled procedure worklist manager
 * 
 * View, create, and manage DICOM worklist entries.
 * Auto-populates scanner form with scheduled patient info.
 */
import React, { useEffect, useState, useCallback } from "react";
import type { WorklistItem } from "@/lib/analyse/types";
import { fetchWorklist, createWorklistItem } from "@/lib/analyse/api";

interface Props {
  onSelectItem?: (item: WorklistItem) => void;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "#42A5F5",
  IN_PROGRESS: "#FFA726",
  COMPLETED: "#66BB6A",
};

export default function WorklistPanel({ onSelectItem, className }: Props) {
  const [items, setItems] = useState<WorklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    patient_name: "",
    patient_id: "",
    modality: "CR",
    scheduled_date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
    procedure_description: "",
    referring_physician: "",
  });

  const loadWorklist = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWorklist();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorklist();
    const interval = setInterval(loadWorklist, 60000);
    return () => clearInterval(interval);
  }, [loadWorklist]);

  const handleCreate = async () => {
    try {
      await createWorklistItem({
        ...formData,
        status: "SCHEDULED",
        scheduled_aet: "MANTHANA",
      });
      setShowForm(false);
      setFormData({
        patient_name: "", patient_id: "", modality: "CR",
        scheduled_date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        procedure_description: "", referring_physician: "",
      });
      await loadWorklist();
    } catch (err: any) {
      alert(`Failed to create worklist item: ${err.message}`);
    }
  };

  const formatDate = (d?: string) => {
    if (!d || d.length !== 8) return d || "—";
    return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
  };

  return (
    <div className={`worklist-panel ${className || ""}`}>
      {/* ─── Header ─── */}
      <div className="pacs-browser-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <h3 className="font-display" style={{ fontSize: 13, margin: 0, color: "var(--text-100)", letterSpacing: "0.05em" }}>
            WORKLIST
          </h3>
          <span className="font-mono" style={{ fontSize: 9, color: "var(--text-30, #555)" }}>
            {items.length} scheduled
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: "var(--scan-400, #1DDFC8)",
            border: "none",
            borderRadius: 4,
            padding: "4px 10px",
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
            color: "#000",
          }}
        >
          + New
        </button>
      </div>

      {/* ─── Create Form ─── */}
      {showForm && (
        <div className="worklist-form">
          <div className="worklist-form-row">
            <input
              placeholder="Patient Name"
              value={formData.patient_name}
              onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
              className="pacs-search-input"
            />
            <input
              placeholder="Patient ID"
              value={formData.patient_id}
              onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
              className="pacs-search-input"
              style={{ width: 100 }}
            />
          </div>
          <div className="worklist-form-row">
            <select
              value={formData.modality}
              onChange={(e) => setFormData({ ...formData, modality: e.target.value })}
              className="pacs-modality-select"
            >
              <option value="CR">X-Ray</option>
              <option value="CT">CT</option>
              <option value="MR">MRI</option>
              <option value="US">Ultrasound</option>
              <option value="MG">Mammography</option>
            </select>
            <input
              type="date"
              value={formData.scheduled_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value.replace(/-/g, "") })}
              className="pacs-search-input"
              style={{ width: 130 }}
            />
          </div>
          <input
            placeholder="Procedure description"
            value={formData.procedure_description}
            onChange={(e) => setFormData({ ...formData, procedure_description: e.target.value })}
            className="pacs-search-input"
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={() => setShowForm(false)} className="pacs-retry-btn" style={{ background: "transparent", color: "var(--text-55, #888)" }}>
              Cancel
            </button>
            <button onClick={handleCreate} className="pacs-analyze-btn">
              Create
            </button>
          </div>
        </div>
      )}

      {/* ─── Worklist Items ─── */}
      <div className="pacs-study-list">
        {loading && items.length === 0 ? (
          <div className="pacs-empty-state">
            <div className="pacs-spinner" />
            <p className="font-mono" style={{ fontSize: 10, color: "var(--text-30, #555)" }}>Loading worklist...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="pacs-empty-state">
            <span style={{ fontSize: 28 }}>📝</span>
            <p className="font-body" style={{ fontSize: 11, color: "var(--text-55, #888)" }}>No scheduled procedures</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.id || idx}
              className="pacs-study-row"
              onClick={() => onSelectItem?.(item)}
            >
              <div className="pacs-study-icon" style={{ fontSize: 14 }}>
                📋
              </div>
              <div className="pacs-study-info">
                <div className="pacs-study-patient font-display">
                  {item.patient_name || "Unnamed"}
                </div>
                <div className="pacs-study-meta font-mono">
                  {item.modality} · {item.procedure_description || "Exam"} · {formatDate(item.scheduled_date)}
                </div>
                {item.referring_physician && (
                  <div className="pacs-study-counts font-mono">
                    Ref: {item.referring_physician}
                  </div>
                )}
              </div>
              <span
                className="pacs-ai-badge font-mono"
                style={{ color: STATUS_COLORS[item.status] || "#888", fontSize: 9 }}
              >
                {item.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
