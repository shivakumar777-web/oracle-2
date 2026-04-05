"use client";
import React, { useState, useCallback } from "react";
import type { DicomMetadataType } from "@/lib/analyse/types";

interface Props {
  metadata: DicomMetadataType | null;
  visible: boolean;
}

function formatDate(raw: string | undefined): string {
  if (!raw || raw.length !== 8) return raw || "–";
  return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
}

function formatAge(raw: string | undefined): string {
  if (!raw) return "–";
  // DICOM age format: "045Y" or "012M" or "007D"
  const match = raw.match(/^(\d+)([YMWD])$/);
  if (!match) return raw;
  const [, n, unit] = match;
  const units: Record<string, string> = { Y: "yrs", M: "mo", W: "wks", D: "days" };
  return `${parseInt(n)} ${units[unit] || unit}`;
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 6, lineHeight: 1.4 }}>
      <span className="font-mono" style={{ fontSize: 7.5, color: "rgba(0,196,176,0.45)", letterSpacing: "0.08em", textTransform: "uppercase", minWidth: 64, flexShrink: 0 }}>
        {label}
      </span>
      <span className="font-mono" style={{ fontSize: 7.5, color: "rgba(245,240,232,0.65)", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}

export default function DicomMetadata({ metadata, visible }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = useCallback(() => setCollapsed((v) => !v), []);

  if (!visible || !metadata) return null;

  return (
    <div
      className="dicom-metadata-overlay"
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 16,
        pointerEvents: "all",
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      <div
        style={{
          background: "rgba(4, 8, 16, 0.72)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(0,196,176,0.12)",
          borderRadius: 6,
          overflow: "hidden",
          maxWidth: 220,
        }}
      >
        {/* Header — click to collapse */}
        <button
          onClick={toggle}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "5px 8px",
            background: "rgba(0,196,176,0.05)",
            border: "none",
            borderBottom: collapsed ? "none" : "1px solid rgba(0,196,176,0.08)",
            cursor: "pointer",
            gap: 6,
          }}
        >
          <span className="font-mono" style={{ fontSize: 7.5, color: "rgba(0,196,176,0.6)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            DICOM Study Info
          </span>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>
            {collapsed ? "▶" : "▼"}
          </span>
        </button>

        {/* Metadata rows */}
        {!collapsed && (
          <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Patient section */}
            {(metadata.patientName || metadata.patientId) && (
              <>
                <MetaRow label="Patient" value={metadata.patientName} />
                <MetaRow label="ID" value={metadata.patientId} />
                <div style={{ display: "flex", gap: 16 }}>
                  {metadata.patientAge && (
                    <MetaRow label="Age" value={formatAge(metadata.patientAge)} />
                  )}
                  {metadata.patientSex && (
                    <MetaRow label="Sex" value={metadata.patientSex === "M" ? "Male" : metadata.patientSex === "F" ? "Female" : metadata.patientSex} />
                  )}
                </div>
              </>
            )}

            {/* Thin separator */}
            {metadata.patientName && <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "2px 0" }} />}

            {/* Study section */}
            <MetaRow label="Date" value={formatDate(metadata.studyDate)} />
            <MetaRow label="Study" value={metadata.studyDescription} />
            <MetaRow label="Hospital" value={metadata.institutionName} />

            {/* Thin separator */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "2px 0" }} />

            {/* Series section */}
            <MetaRow label="Modality" value={metadata.modality} />
            <MetaRow label="Series" value={metadata.seriesDescription} />
            <MetaRow label="Body Part" value={metadata.bodyPartExamined} />

            {/* Thin separator */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "2px 0" }} />

            {/* Image section */}
            <MetaRow label="Thickness" value={metadata.sliceThickness ? `${metadata.sliceThickness} mm` : undefined} />
            <MetaRow label="Px Spacing" value={metadata.pixelSpacing ? `${metadata.pixelSpacing} mm` : undefined} />
            {metadata.sliceLocation && (
              <MetaRow label="Slice Loc" value={`${parseFloat(metadata.sliceLocation).toFixed(1)} mm`} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
