"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";
import type {
  CtBodyRegion,
  CtContrastPhase,
  CtDicomFileBand,
  CtUploadPathKind,
  CtWizardState,
} from "@/lib/analyse/ct-upload-wizard";
import {
  CT_WIZARD_INITIAL,
  ctDicomBandsForRegion,
  ctImageUploadHint,
  ctQualityMessage,
} from "@/lib/analyse/ct-upload-wizard";

interface Props {
  onComplete: (state: CtWizardState) => void;
  lockRegion?: CtBodyRegion;
}

const REGIONS: { id: CtBodyRegion; label: string; hint: string }[] = [
  { id: "chest_ct", label: "Chest", hint: "Thoracic CT" },
  { id: "cardiac_ct", label: "Cardiac", hint: "Heart CT" },
  { id: "abdominal_ct", label: "Abdomen / Pelvis", hint: "Abdominopelvic CT" },
  { id: "spine_ct", label: "Spine", hint: "Spinal CT" },
  { id: "ct_brain", label: "Brain (NCCT)", hint: "Non-contrast head CT" },
];

const CONTRAST_OPTIONS: {
  id: CtContrastPhase;
  title: string;
  blurb: string;
}[] = [
  {
    id: "non_contrast",
    title: "Non-contrast (NCCT)",
    blurb: "Standard screening, kidney stones, acute bleed workup",
  },
  {
    id: "contrast",
    title: "With contrast (CECT)",
    blurb: "Liver lesions, tumours, vascular, infection",
  },
  {
    id: "both_phases",
    title: "Both phases (NCCT + CECT)",
    blurb: "Complete oncology or staging workup",
  },
];

function bandIndicator(level: "bad" | "mid" | "good" | "best"): string {
  switch (level) {
    case "bad":
      return "\u25CF";
    case "mid":
      return "\u25CF";
    case "good":
    case "best":
      return "\u25CF";
    default:
      return "\u25CF";
  }
}

function bandColor(level: "bad" | "mid" | "good" | "best"): string {
  switch (level) {
    case "bad":
      return "var(--critical)";
    case "mid":
      return "var(--warning)";
    case "good":
    case "best":
      return "var(--clear)";
    default:
      return "var(--text-30)";
  }
}

export default function CtUploadWizard({ onComplete, lockRegion }: Props) {
  const { isMobile, isTablet } = useMediaQuery();
  const compact = isMobile || isTablet;
  const regionLocked = lockRegion != null;
  const [step, setStep] = useState(regionLocked ? 2 : 1);

  const [region, setRegion] = useState<CtBodyRegion>(lockRegion ?? CT_WIZARD_INITIAL.region);
  const [contrast_phase, setContrastPhase] = useState<CtContrastPhase>(CT_WIZARD_INITIAL.contrast_phase);
  const [upload_path, setUploadPath] = useState<CtUploadPathKind>(CT_WIZARD_INITIAL.upload_path);
  const [dicom_file_band, setDicomFileBand] = useState<CtDicomFileBand>(CT_WIZARD_INITIAL.dicom_file_band);
  const [image_view_mode, setImageViewMode] = useState<"single" | "multi">(CT_WIZARD_INITIAL.image_view_mode);
  const [brain_trauma_context, setBrainTraumaContext] = useState(false);
  const [anticoagulant_therapy, setAnticoagulantTherapy] = useState(false);
  const [acute_neuro_deficit_symptoms, setAcuteNeuroDeficitSymptoms] = useState(false);

  const dicomBands = useMemo(() => ctDicomBandsForRegion(region), [region]);
  const q = useMemo(() => ctQualityMessage(dicom_file_band, region), [dicom_file_band, region]);
  const imageHint = useMemo(() => ctImageUploadHint(region), [region]);

  useEffect(() => {
    if (lockRegion) {
      setRegion(lockRegion);
      setStep(2);
    }
  }, [lockRegion]);

  useEffect(() => {
    if (region !== "ct_brain") {
      setBrainTraumaContext(false);
      setAnticoagulantTherapy(false);
      setAcuteNeuroDeficitSymptoms(false);
    }
  }, [region]);

  const finish = () => {
    const brainOpts =
      region === "ct_brain"
        ? {
            ...(brain_trauma_context ? { brain_trauma_context: true as const } : {}),
            ...(anticoagulant_therapy ? { anticoagulant_therapy: true as const } : {}),
            ...(acute_neuro_deficit_symptoms ? { acute_neuro_deficit_symptoms: true as const } : {}),
          }
        : {};
    onComplete({
      region,
      contrast_phase,
      upload_path,
      dicom_file_band,
      image_view_mode,
      scanner_slices: null,
      ...brainOpts,
    });
  };

  return (
    <div
      className="glass-panel"
      style={{
        flex: 1,
        margin: compact ? 8 : 16,
        padding: compact ? 16 : 28,
        borderRadius: "var(--r-md)",
        minHeight: compact ? 280 : 400,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        overflowY: "auto",
      }}
    >
      <div>
        <p className="text-caption" style={{ color: "var(--text-30)", marginBottom: 6, letterSpacing: "0.12em" }}>
          CT SCAN SETUP
        </p>
        <h3 className="font-display" style={{ fontSize: compact ? 14 : 16, color: "var(--text-55)", fontWeight: 600 }}>
          Step {regionLocked ? step - 1 : step} of {regionLocked ? 2 : 3}
        </h3>
      </div>

      {step === 1 && !regionLocked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="font-body" style={{ fontSize: 13, color: "var(--text-40)" }}>
            Select body region (routes to the correct analysis service).
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: compact ? "1fr 1fr" : "repeat(auto-fill, minmax(118px, 1fr))",
              gap: 10,
            }}
          >
            {REGIONS.map((r) => {
              const active = region === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRegion(r.id)}
                  className={active ? "btn-teal" : "btn-ghost"}
                  style={{
                    padding: "14px 12px",
                    borderRadius: "var(--r-sm)",
                    border: active ? "none" : "1px solid var(--glass-border)",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    background: active ? undefined : "rgba(255,255,255,0.02)",
                  }}
                >
                  <span className="font-display" style={{ fontSize: 12, fontWeight: 600 }}>
                    {r.label}
                  </span>
                  <span className="text-caption" style={{ fontSize: 9, opacity: 0.75 }}>
                    {r.hint}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn-teal" style={{ fontSize: 11, padding: "10px 24px" }} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p className="font-body" style={{ fontSize: 13, color: "var(--text-40)" }}>
            Contrast phase (helps the narrative match NCCT vs CECT).
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CONTRAST_OPTIONS.map((c) => {
              const active = contrast_phase === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setContrastPhase(c.id)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: "var(--r-sm)",
                    border: active ? "1px solid var(--scan-500)" : "1px solid var(--glass-border)",
                    background: active ? "rgba(0,196,176,0.08)" : "rgba(255,255,255,0.02)",
                    cursor: "pointer",
                  }}
                >
                  <div className="font-display" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    {active ? "\u25C9 " : "\u25CB "}
                    {c.title}
                  </div>
                  <div className="font-body" style={{ fontSize: 11, color: "var(--text-30)", lineHeight: 1.45 }}>
                    {c.blurb}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            {!regionLocked ? (
              <button type="button" className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setStep(1)}>
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="btn-teal" style={{ fontSize: 11, padding: "10px 24px" }} onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {region === "ct_brain" && (
            <div
              style={{
                padding: 14,
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <p className="font-display" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--scan-400)" }}>
                NCCT BRAIN — CLINICAL CONTEXT (OPTIONAL)
              </p>
              <p className="text-caption" style={{ fontSize: 10, color: "var(--text-30)", margin: 0, lineHeight: 1.45 }}>
                Triage hints only; sent with patient_context_json for narrative correlation. Does not change model thresholds.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input type="checkbox" checked={brain_trauma_context} onChange={(e) => setBrainTraumaContext(e.target.checked)} />
                Trauma / head injury context
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input type="checkbox" checked={anticoagulant_therapy} onChange={(e) => setAnticoagulantTherapy(e.target.checked)} />
                Anticoagulant / antiplatelet therapy
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={acute_neuro_deficit_symptoms}
                  onChange={(e) => setAcuteNeuroDeficitSymptoms(e.target.checked)}
                />
                Acute neurological deficit / stroke workup
              </label>
            </div>
          )}
          <p className="font-body" style={{ fontSize: 13, color: "var(--text-40)" }}>
            How are you uploading this study?
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={upload_path === "dicom" ? "btn-teal" : "btn-ghost"}
              style={{ fontSize: 10, padding: "8px 14px", borderRadius: "var(--r-full)", border: "1px solid var(--glass-border)" }}
              onClick={() => setUploadPath("dicom")}
            >
              DICOM from CT workstation
            </button>
            <button
              type="button"
              className={upload_path === "image" ? "btn-teal" : "btn-ghost"}
              style={{ fontSize: 10, padding: "8px 14px", borderRadius: "var(--r-full)", border: "1px solid var(--glass-border)" }}
              onClick={() => setUploadPath("image")}
            >
              JPG / PNG (films or screenshots)
            </button>
          </div>

          {upload_path === "dicom" && (
            <div
              style={{
                padding: 14,
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <p className="font-display" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--scan-400)" }}>
                DICOM SERIES
              </p>
              <label className="text-caption" style={{ fontSize: 10, color: "var(--text-30)" }}>
                How many image files do you have?
              </label>
              <select
                value={dicom_file_band}
                onChange={(e) => setDicomFileBand(e.target.value as CtDicomFileBand)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--glass-border)",
                  background: "rgba(0,0,0,0.35)",
                  color: "var(--text-55)",
                  fontSize: 12,
                }}
              >
                {dicomBands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4 }}>
                <span style={{ color: bandColor(q.level), fontSize: 14, lineHeight: 1.2 }} aria-hidden>
                  {bandIndicator(q.level)}
                </span>
                <p className="font-body" style={{ fontSize: 11, color: "var(--text-40)", lineHeight: 1.5, margin: 0 }}>
                  {q.text}
                </p>
              </div>
              <p className="font-mono" style={{ fontSize: 9, color: "var(--text-15)", marginTop: 4 }}>
                Zip your DICOM folder and upload. Recommended max 400 MB per upload.
              </p>
            </div>
          )}

          {upload_path === "image" && (
            <div
              style={{
                padding: 14,
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <p className="font-display" style={{ fontSize: 11, marginBottom: 8, color: "var(--warning)" }}>
                {imageHint.title}
              </p>
              <p className="font-body" style={{ fontSize: 12, color: "var(--text-40)", lineHeight: 1.55, marginBottom: 12 }}>
                {imageHint.body}
              </p>
              <p className="text-caption" style={{ fontSize: 10, color: "var(--text-30)", marginBottom: 8 }}>
                How many images?
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="radio"
                  name="ct_img_views"
                  checked={image_view_mode === "single"}
                  onChange={() => setImageViewMode("single")}
                />
                Single image (one view)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="radio"
                  name="ct_img_views"
                  checked={image_view_mode === "multi"}
                  onChange={() => setImageViewMode("multi")}
                />
                Multiple images (2–10 views)
              </label>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <button type="button" className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" className="btn-teal" style={{ fontSize: 11, padding: "10px 24px" }} onClick={finish}>
              Continue to upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
