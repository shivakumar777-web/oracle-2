"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import AnalysisModeSwitcher from "@/components/analyse/shared/AnalysisModeSwitcher";
import type { AnalysisMode } from "@/lib/analyse/types";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";
import {
  createInitialEcgScannerContext,
  ecgFormCompletionPercent,
  ecgFormHasRequiredDemographics,
  fillSampleEcgScannerContext,
  type EcgFormData,
  type EcgScannerContext,
} from "@/lib/analyse/ecgPatientContext";
import { ECG_SECTIONS, accentBorderColor } from "@/lib/analyse/ecgFormConfig";
import ClinicalCalculatorsPanel from "./ClinicalCalculatorsPanel";
import DemographicsSection from "./sections/DemographicsSection";
import PresentingComplaintSection from "./sections/PresentingComplaintSection";
import VitalsSection from "./sections/VitalsSection";
import CardiacHistorySection from "./sections/CardiacHistorySection";
import MedicalHistorySection from "./sections/MedicalHistorySection";
import FamilyHistorySection from "./sections/FamilyHistorySection";
import LifestyleSection from "./sections/LifestyleSection";
import MedicationsSection from "./sections/MedicationsSection";
import RecentEventsSection from "./sections/RecentEventsSection";
import LabValuesSection from "./sections/LabValuesSection";
import ECGContextSection from "./sections/ECGContextSection";
import { ecgInputStyle } from "./ecgFieldPrimitives";

interface Props {
  scanNumber: number;
  onContextChange: (ctx: EcgScannerContext) => void;
  analysisMode?: AnalysisMode;
  onAnalysisModeChange?: (mode: AnalysisMode) => void;
}

export default function ECGPatientContextForm({
  scanNumber,
  onContextChange,
  analysisMode = "single",
  onAnalysisModeChange,
}: Props) {
  const { isMobile, isTablet } = useMediaQuery();
  const compact = isMobile || isTablet;
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(["demographics"]));
  const [ctx, setCtx] = useState<EcgScannerContext>(() => createInitialEcgScannerContext(scanNumber));
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    setCtx(createInitialEcgScannerContext(scanNumber));
  }, [scanNumber]);

  useEffect(() => {
    onContextChange(ctx);
  }, [ctx, onContextChange]);

  const patchForm = useCallback((fn: (f: EcgFormData) => EcgFormData) => {
    setCtx((c) => {
      const ecgForm = fn(c.ecgForm);
      const age = ecgForm.demographics.age;
      const gender = ecgForm.demographics.sex;
      let tobaccoUse = c.tobaccoUse;
      if (ecgForm.lifestyle.smoking_status === "current") tobaccoUse = "smoking";
      else if (ecgForm.lifestyle.tobacco_chewing) tobaccoUse = "chewing";
      else if (ecgForm.lifestyle.smoking_status === "ex-smoker") tobaccoUse = "ex-smoker";
      else if (ecgForm.lifestyle.smoking_status === "never") tobaccoUse = "none";
      return {
        ...c,
        ecgForm,
        age,
        gender,
        tobaccoUse,
      };
    });
  }, []);

  const patchFormPartial = useCallback(
    (patch: Partial<EcgFormData>) => {
      patchForm((f) => ({ ...f, ...patch }));
    },
    [patchForm]
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (compact) return new Set([id]);
      next.add(id);
      return next;
    });
  };

  const completion = useMemo(() => ecgFormCompletionPercent(ctx.ecgForm), [ctx.ecgForm]);
  const hasRequired = ecgFormHasRequiredDemographics(ctx.ecgForm);

  const detectLocation = async () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10`,
            { headers: { "Accept-Language": "en" }, signal: AbortSignal.timeout(5000) }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const loc = [addr.city || addr.town || addr.village || addr.county, addr.state, addr.country]
              .filter(Boolean)
              .join(", ");
            if (loc) setCtx((c) => ({ ...c, location: loc }));
          }
        } catch {
          /* ignore */
        }
        setDetecting(false);
      },
      () => setDetecting(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  const fillSample = () => {
    setCtx(fillSampleEcgScannerContext(scanNumber));
  };

  const sectionBody = (id: string) => {
    const f = ctx.ecgForm;
    switch (id) {
      case "demographics":
        return (
          <DemographicsSection
            data={f.demographics}
            compact={compact}
            onChange={(p) => patchForm((prev) => ({ ...prev, demographics: { ...prev.demographics, ...p } }))}
          />
        );
      case "presenting":
        return (
          <PresentingComplaintSection
            data={f.presenting_complaint}
            compact={compact}
            onChange={(p) =>
              patchForm((prev) => ({ ...prev, presenting_complaint: { ...prev.presenting_complaint, ...p } }))
            }
          />
        );
      case "vitals":
        return (
          <VitalsSection
            data={f.vitals_at_presentation}
            compact={compact}
            onChange={(p) =>
              patchForm((prev) => ({ ...prev, vitals_at_presentation: { ...prev.vitals_at_presentation, ...p } }))
            }
          />
        );
      case "cardiac":
        return (
          <CardiacHistorySection
            data={f.cardiac_history}
            compact={compact}
            onChange={(p) => patchForm((prev) => ({ ...prev, cardiac_history: { ...prev.cardiac_history, ...p } }))}
          />
        );
      case "medical":
        return (
          <MedicalHistorySection
            data={f.medical_history}
            compact={compact}
            onChange={(p) => patchForm((prev) => ({ ...prev, medical_history: { ...prev.medical_history, ...p } }))}
          />
        );
      case "family":
        return (
          <FamilyHistorySection
            data={f.family_history}
            compact={compact}
            onChange={(p) => patchForm((prev) => ({ ...prev, family_history: { ...prev.family_history, ...p } }))}
          />
        );
      case "lifestyle":
        return (
          <LifestyleSection
            data={f.lifestyle}
            compact={compact}
            onChange={(p) => patchForm((prev) => ({ ...prev, lifestyle: { ...prev.lifestyle, ...p } }))}
          />
        );
      case "medications":
        return (
          <MedicationsSection
            data={f.current_medications}
            compact={compact}
            onChange={(rows) => patchForm((prev) => ({ ...prev, current_medications: rows }))}
          />
        );
      case "recent":
        return (
          <RecentEventsSection
            data={f.recent_events}
            compact={compact}
            onChange={(p) => patchForm((prev) => ({ ...prev, recent_events: { ...prev.recent_events, ...p } }))}
          />
        );
      case "labs":
        return (
          <LabValuesSection
            data={f.lab_values_if_available}
            compact={compact}
            onChange={(p) =>
              patchForm((prev) => ({
                ...prev,
                lab_values_if_available: { ...prev.lab_values_if_available, ...p },
              }))
            }
          />
        );
      case "ecg_ctx":
        return (
          <ECGContextSection
            data={f.ecg_context}
            compact={compact}
            onChange={(p) => patchForm((prev) => ({ ...prev, ecg_context: { ...prev.ecg_context, ...p } }))}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        padding: compact ? "0 10px 10px" : "0 16px 12px",
        borderBottom: "1px solid var(--glass-border)",
      }}
    >
      <button
        type="button"
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
          <span className="text-caption" style={{ color: "var(--text-30)", fontSize: 9, flexShrink: 0 }}>
            ECG PATIENT CONTEXT
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
            {ctx.patientId}
          </span>
          {onAnalysisModeChange && (
            <div style={{ marginLeft: 8, flexShrink: 0 }}>
              <AnalysisModeSwitcher mode={analysisMode} onChange={onAnalysisModeChange} />
            </div>
          )}
        </div>
        <span style={{ color: "var(--text-55)", fontSize: 15, fontWeight: 600 }}>{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <>
          <p className="font-body" style={{ fontSize: 10, fontStyle: "italic", color: "var(--text-30)", marginBottom: 8 }}>
            Optional fields improve AI interpretation. Only <strong>age</strong> and <strong>sex</strong> are required
            before upload. English reports only.
          </p>

          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${completion}%`,
                  background: "linear-gradient(90deg, var(--scan-600), var(--scan-400))",
                  transition: "width 0.25s ease-out",
                }}
              />
            </div>
            <span className="text-caption" style={{ fontSize: 8, color: "var(--text-30)" }}>
              Context completeness ~{completion}%
            </span>
          </div>

          {!hasRequired && (
            <p style={{ fontSize: 10, color: "rgba(255,149,0,0.9)", marginBottom: 8 }}>
              Add age and sex in section 1 before running ECG analysis.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: compact ? "column" : "row", gap: 12, alignItems: "stretch" }}>
            <div style={{ flex: compact ? undefined : "1 1 58%", minWidth: 0 }}>
              <div style={{ marginBottom: 10 }}>
                <span className="text-caption" style={{ fontSize: 8, color: "var(--text-15)", display: "block", marginBottom: 4 }}>
                  GEOGRAPHIC AREA (optional)
                </span>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="City / region or GPS"
                    value={ctx.location}
                    onChange={(e) => setCtx((c) => ({ ...c, location: e.target.value }))}
                    style={{ ...ecgInputStyle, paddingRight: 36 }}
                  />
                  <button
                    type="button"
                    title="Detect location"
                    onClick={detectLocation}
                    disabled={detecting}
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
                    }}
                  >
                    📍
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <span className="text-caption" style={{ fontSize: 8, color: "var(--text-15)", display: "block", marginBottom: 4 }}>
                  EXTRA SYMPTOMS (free text, optional)
                </span>
                <textarea
                  rows={2}
                  value={ctx.symptoms}
                  onChange={(e) => setCtx((c) => ({ ...c, symptoms: e.target.value }))}
                  style={{ ...ecgInputStyle, resize: "vertical", minHeight: 44 }}
                  placeholder="Anything not captured in structured sections…"
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <span className="text-caption" style={{ fontSize: 8, color: "var(--text-15)", display: "block", marginBottom: 4 }}>
                  EXTRA CLINICAL NOTES (free text, optional)
                </span>
                <textarea
                  rows={2}
                  value={ctx.clinicalHistory}
                  onChange={(e) => setCtx((c) => ({ ...c, clinicalHistory: e.target.value }))}
                  style={{ ...ecgInputStyle, resize: "vertical", minHeight: 44 }}
                  placeholder="Timeline, prior workup, clinician reminders…"
                />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <button type="button" className="btn-teal" style={{ fontSize: 10, padding: "6px 12px" }} onClick={fillSample}>
                  Fill sample (demo)
                </button>
              </div>

              {ECG_SECTIONS.map((sec) => {
                const open = openSections.has(sec.id);
                return (
                  <div
                    key={sec.id}
                    style={{
                      marginBottom: 8,
                      borderRadius: "var(--r-sm)",
                      border: `1px solid ${accentBorderColor(sec.accent)}`,
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(sec.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        background: open ? "rgba(0,196,176,0.06)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-100)" }}>{sec.title}</span>
                      <span style={{ color: "var(--text-55)", fontSize: 11 }}>{open ? "▾" : "▸"}</span>
                    </button>
                    {open && (
                      <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--glass-border)" }}>
                        <p style={{ fontSize: 9, color: "var(--text-30)", margin: "8px 0", fontStyle: "italic" }}>
                          {sec.shortHint}
                        </p>
                        {sectionBody(sec.id)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!compact && (
              <div
                style={{
                  flex: "0 0 38%",
                  position: "sticky",
                  top: 8,
                  alignSelf: "flex-start",
                  maxHeight: "min(80vh, 720px)",
                  overflowY: "auto",
                }}
              >
                <div className="text-caption" style={{ fontSize: 8, color: "var(--text-30)", marginBottom: 8 }}>
                  CLINICAL SUMMARY
                </div>
                <ClinicalCalculatorsPanel ctx={ctx} onPatchForm={patchFormPartial} />
              </div>
            )}
          </div>

          {compact && (
            <div
              style={{
                position: "sticky",
                bottom: 0,
                marginTop: 12,
                padding: "10px 0",
                background: "linear-gradient(180deg, transparent, var(--void-2) 20%)",
                borderTop: "1px solid var(--glass-border)",
              }}
            >
              <div className="text-caption" style={{ fontSize: 8, color: "var(--text-30)", marginBottom: 6 }}>
                QUICK SUMMARY
              </div>
              <ClinicalCalculatorsPanel ctx={ctx} onPatchForm={patchFormPartial} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
