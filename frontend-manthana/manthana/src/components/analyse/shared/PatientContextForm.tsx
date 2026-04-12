"use client";
import React, { useState, useEffect } from "react";
import AnalysisModeSwitcher from "./AnalysisModeSwitcher";
import type { AnalysisMode } from "@/lib/analyse/types";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";

export interface PatientContext {
  patientId: string;
  age: string;
  gender: string;
  location: string;
  /** Tobacco / betel use — forwarded as clinical_notes to analysis */
  tobaccoUse: string;
  fastingStatus?: string;
  medications?: string;
  /** Presenting complaint / symptoms — free text, sent to AI narrative */
  symptoms: string;
  /** Past history, comorbidities, timeline — free text, sent to AI narrative */
  clinicalHistory: string;
}

interface Props {
  scanNumber: number;
  onContextChange: (ctx: PatientContext) => void;
  analysisMode?: AnalysisMode;
  onAnalysisModeChange?: (mode: AnalysisMode) => void;
  /** When set to lab_report, show fasting / medications for lab interpretation */
  modality?: string;
}

export default function PatientContextForm({
  scanNumber,
  onContextChange,
  analysisMode = "single",
  onAnalysisModeChange,
  modality,
}: Props) {
  const { isMobile, isTablet } = useMediaQuery();
  const compact = isMobile || isTablet;
  const patientId = `ANONYMOUS-${String(scanNumber).padStart(3, "0")}`;

  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("");
  const [tobaccoUse, setTobaccoUse] = useState("");
  const [fastingStatus, setFastingStatus] = useState("unknown");
  const [medications, setMedications] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [clinicalHistory, setClinicalHistory] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const [detecting, setDetecting] = useState(false);

  const isLabReport = modality === "lab_report";

  // Propagate changes
  useEffect(() => {
    onContextChange({
      patientId,
      age,
      gender,
      location,
      tobaccoUse,
      symptoms,
      clinicalHistory,
      ...(isLabReport
        ? { fastingStatus, medications }
        : {}),
    });
  }, [
    patientId,
    age,
    gender,
    location,
    tobaccoUse,
    symptoms,
    clinicalHistory,
    fastingStatus,
    medications,
    isLabReport,
    onContextChange,
  ]);

  const detectLocation = async () => {
    if (!navigator.geolocation) {
      return; // GPS not supported — user types manually
    }

    setDetecting(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // Got GPS coords — reverse geocode to get readable location
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10`,
            {
              headers: { "Accept-Language": "en" },
              signal: AbortSignal.timeout(5000),
            }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const loc = [
              addr.city || addr.town || addr.village || addr.county,
              addr.state,
              addr.country,
            ]
              .filter(Boolean)
              .join(", ");
            if (loc) setLocation(loc);
          }
        } catch {
          // Reverse geocode failed — silent, user can type manually
        }
        setDetecting(false);
      },
      () => {
        // Permission denied or error — silent fail, user types manually
        setDetecting(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--glass-border)",
    borderRadius: "var(--r-sm)",
    padding: "7px 10px",
    color: "var(--text-100)",
    fontFamily: "var(--font-display)",
    fontSize: 12,
    outline: "none",
    width: "100%",
    transition: "border-color var(--dur-fast)",
  };

  return (
    <div
      style={{
        padding: compact ? "0 10px 10px" : "0 16px 12px",
        borderBottom: "1px solid var(--glass-border)",
      }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "8px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-display)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span
            className="text-caption"
            style={{ color: "var(--text-30)", fontSize: 9, flexShrink: 0 }}
          >
            PATIENT CONTEXT
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              color: "var(--scan-400)",
              padding: "2px 6px",
              background: "rgba(0,196,176,0.06)",
              borderRadius: "var(--r-full)",
              border: "1px solid rgba(0,196,176,0.12)",
              flexShrink: 0,
            }}
          >
            {patientId}
          </span>
          {/* Analysis Mode Switcher */}
          {onAnalysisModeChange && (
            <div style={{ marginLeft: 8, flexShrink: 0 }}>
              <AnalysisModeSwitcher mode={analysisMode} onChange={onAnalysisModeChange} />
            </div>
          )}
        </div>
        <span
          style={{
            color: "var(--text-55)",
            fontSize: 15,
            lineHeight: 1,
            fontWeight: 600,
            minWidth: 18,
            textAlign: "center",
            transition: "transform 0.2s, color 0.2s",
          }}
          aria-hidden
        >
          {collapsed ? "▸" : "▾"}
        </span>
      </button>

      {/* Hint */}
      {!collapsed && (
        <p
          className="font-body"
          style={{
            fontSize: 10,
            fontStyle: "italic",
            color: "var(--text-30)",
            marginBottom: 10,
            lineHeight: 1.4,
          }}
        >
          Optional — providing this improves report accuracy. Fully anonymous, no names stored.
        </p>
      )}

      {/* Form fields */}
      {!collapsed && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr" : "1fr 1fr",
            gap: 8,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {/* Patient ID — readonly */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="text-caption" style={{ color: "var(--text-15)", fontSize: 8, marginBottom: 3, display: "block" }}>
              PATIENT ID
            </label>
            <input
              type="text"
              value={patientId}
              readOnly
              style={{
                ...inputStyle,
                color: "var(--scan-400)",
                fontFamily: "var(--font-mono)",
                background: "rgba(0,196,176,0.04)",
                borderColor: "rgba(0,196,176,0.12)",
                cursor: "default",
              }}
            />
          </div>

          {/* Age */}
          <div>
            <label className="text-caption" style={{ color: "var(--text-15)", fontSize: 8, marginBottom: 3, display: "block" }}>
              AGE
            </label>
            <input
              type="number"
              placeholder="e.g. 45"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(0,196,176,0.3)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; }}
            />
          </div>

          {/* Gender */}
          <div>
            <label className="text-caption" style={{ color: "var(--text-15)", fontSize: 8, marginBottom: 3, display: "block" }}>
              GENDER
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{
                ...inputStyle,
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23555' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                paddingRight: 28,
              }}
            >
              <option value="" style={{ background: "var(--void-3)" }}>Select</option>
              <option value="M" style={{ background: "var(--void-3)" }}>Male</option>
              <option value="F" style={{ background: "var(--void-3)" }}>Female</option>
              <option value="Other" style={{ background: "var(--void-3)" }}>Other</option>
            </select>
          </div>

          {/* Symptoms & history — free text for LLM correlation */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="text-caption" style={{ color: "var(--text-15)", fontSize: 8, marginBottom: 3, display: "block" }}>
              SYMPTOMS & PRESENTING COMPLAINT
            </label>
            <textarea
              placeholder="e.g. Sudden weakness right arm and leg since this morning, headache, vomiting once…"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              rows={compact ? 3 : 2}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: compact ? 56 : 44,
                lineHeight: 1.35,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(0,196,176,0.3)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="text-caption" style={{ color: "var(--text-15)", fontSize: 8, marginBottom: 3, display: "block" }}>
              CLINICAL HISTORY & CONTEXT
            </label>
            <textarea
              placeholder="e.g. Known hypertension, on aspirin; prior stroke 2019; no diabetes…"
              value={clinicalHistory}
              onChange={(e) => setClinicalHistory(e.target.value)}
              rows={compact ? 3 : 2}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: compact ? 56 : 44,
                lineHeight: 1.35,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(0,196,176,0.3)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; }}
            />
            <p
              className="font-body"
              style={{
                fontSize: 9,
                color: "var(--text-30)",
                marginTop: 6,
                marginBottom: 0,
                lineHeight: 1.35,
              }}
            >
              Plain language is fine. This text is sent with your scan to the report AI (with age, location, etc.) to tailor interpretation — not stored as a medical record ID.
            </p>
          </div>

          {/* Tobacco / betel — oral cancer risk context */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="text-caption" style={{ color: "var(--text-15)", fontSize: 8, marginBottom: 3, display: "block" }}>
              TOBACCO / BETEL USE
            </label>
            <select
              value={tobaccoUse}
              onChange={(e) => setTobaccoUse(e.target.value)}
              style={{
                ...inputStyle,
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23555' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                paddingRight: 28,
              }}
            >
              <option value="" style={{ background: "var(--void-3)" }}>Not specified</option>
              <option value="none" style={{ background: "var(--void-3)" }}>None</option>
              <option value="chewing" style={{ background: "var(--void-3)" }}>Chewing (gutka / pan masala)</option>
              <option value="smoking" style={{ background: "var(--void-3)" }}>Smoking</option>
              <option value="both" style={{ background: "var(--void-3)" }}>Both</option>
            </select>
          </div>

          {isLabReport && (
            <>
              <div>
                <label className="text-caption" style={{ color: "var(--text-15)", fontSize: 8, marginBottom: 3, display: "block" }}>
                  FASTING (LAB)
                </label>
                <select
                  value={fastingStatus}
                  onChange={(e) => setFastingStatus(e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23555' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 10px center",
                    paddingRight: 28,
                  }}
                >
                  <option value="unknown">Unknown</option>
                  <option value="fasting">Fasting (8h+)</option>
                  <option value="non_fasting">Non-fasting</option>
                </select>
              </div>
              <div style={{ gridColumn: compact ? "1 / -1" : "1 / -1" }}>
                <label className="text-caption" style={{ color: "var(--text-15)", fontSize: 8, marginBottom: 3, display: "block" }}>
                  CURRENT MEDICATIONS (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. metformin 500mg BD"
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(0,196,176,0.3)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; }}
                />
              </div>
            </>
          )}

          {/* Location — GPS button to detect, or type manually */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label
              className="text-caption"
              style={{
                color: "var(--text-15)",
                fontSize: 8,
                marginBottom: 3,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              GEOGRAPHIC AREA
              {detecting && (
                <span style={{ color: "var(--scan-400)", animation: "pulse 1s infinite" }}>
                  detecting…
                </span>
              )}
              {location && !detecting && (
                <span style={{ color: "var(--clear)", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>
                  ✓ detected
                </span>
              )}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Type city/region or click 📍 to auto-detect"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: location ? "rgba(48,209,88,0.15)" : "var(--glass-border)",
                  paddingRight: 36,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(0,196,176,0.3)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = location ? "rgba(48,209,88,0.15)" : "var(--glass-border)"; }}
              />
              {/* GPS detect button */}
              <button
                type="button"
                onClick={detectLocation}
                disabled={detecting}
                title="Detect my location"
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: detecting ? "wait" : "pointer",
                  fontSize: 15,
                  opacity: detecting ? 0.5 : 1,
                  transition: "opacity 0.2s, transform 0.2s",
                  padding: "2px 4px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  animation: detecting ? "pulse 1s infinite" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!detecting) (e.currentTarget as HTMLElement).style.transform = "translateY(-50%) scale(1.2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-50%)";
                }}
              >
                📍
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
