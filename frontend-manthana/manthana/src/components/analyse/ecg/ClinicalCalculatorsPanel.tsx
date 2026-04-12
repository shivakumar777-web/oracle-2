"use client";

import React, { useMemo } from "react";
import type { EcgFormData, EcgScannerContext } from "@/lib/analyse/ecgPatientContext";
import { medicationHasQtRisk } from "@/lib/analyse/ecgFormConfig";
import {
  cha2ds2VascInterpret,
  classifyQtc,
  computeBmiKgM2,
  computeCha2ds2Vasc,
  hrToRrMs,
  qtcBazett,
  qtcBandColor,
} from "@/lib/analyse/clinicalCalculators";
import { ecgInputStyle } from "./ecgFieldPrimitives";

function parseNum(s: string): number | null {
  const n = parseFloat(String(s).trim());
  return Number.isFinite(n) ? n : null;
}

export default function ClinicalCalculatorsPanel({
  ctx,
  onPatchForm,
}: {
  ctx: EcgScannerContext;
  onPatchForm: (patch: Partial<EcgFormData>) => void;
}) {
  const d = ctx.ecgForm;
  const sexChar = d.demographics.sex === "F" ? "F" : d.demographics.sex === "M" ? "M" : "Other";

  const qtcResult = useMemo(() => {
    const qt = parseNum(d.calculator_qt_ms);
    const hrManual = parseNum(d.calculator_hr_bpm);
    const hrVital = parseNum(d.vitals_at_presentation.heart_rate);
    const hr = hrManual ?? hrVital;
    if (qt === null || hr === null) return null;
    const rr = hrToRrMs(hr);
    if (rr === null) return null;
    const qtc = qtcBazett(qt, rr);
    if (qtc === null) return null;
    const band = classifyQtc(qtc, sexChar);
    return { qtc, band, hrUsed: hr };
  }, [
    d.calculator_qt_ms,
    d.calculator_hr_bpm,
    d.vitals_at_presentation.heart_rate,
    sexChar,
  ]);

  const cha = useMemo(() => {
    const age = parseNum(d.demographics.age);
    if (age === null) return null;
    const score = computeCha2ds2Vasc({
      age,
      sex: sexChar,
      congestiveHeartFailure: d.cardiac_history.heart_failure,
      hypertension: d.medical_history.hypertension,
      diabetes: d.medical_history.diabetes,
      strokeOrTia: d.medical_history.stroke_tia,
      vascularDisease:
        d.medical_history.peripheral_arterial_disease ||
        d.cardiac_history.prior_mi ||
        d.cardiac_history.known_cad,
    });
    return { score, text: cha2ds2VascInterpret(score) };
  }, [
    d.demographics.age,
    sexChar,
    d.cardiac_history.heart_failure,
    d.medical_history.hypertension,
    d.medical_history.diabetes,
    d.medical_history.stroke_tia,
    d.medical_history.peripheral_arterial_disease,
    d.cardiac_history.prior_mi,
    d.cardiac_history.known_cad,
  ]);

  const bmi = useMemo(() => {
    const h = parseNum(d.medical_history.height_m);
    const w = parseNum(d.medical_history.weight_kg);
    if (h === null || w === null) return null;
    return computeBmiKgM2(w, h);
  }, [d.medical_history.height_m, d.medical_history.weight_kg]);

  const qtDrugWarning = d.current_medications.some((m) => m.drug.trim() && medicationHasQtRisk(m.drug));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontSize: 11,
        color: "var(--text-55)",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--glass-border)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="text-caption" style={{ fontSize: 8, color: "var(--text-30)", marginBottom: 6 }}>
          QTc (Bazett)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 8, color: "var(--text-15)", display: "block", marginBottom: 2 }}>QT (ms)</span>
            <input
              type="number"
              placeholder="e.g. 380"
              value={d.calculator_qt_ms}
              onChange={(e) => onPatchForm({ calculator_qt_ms: e.target.value })}
              style={ecgInputStyle}
            />
          </div>
          <div>
            <span style={{ fontSize: 8, color: "var(--text-15)", display: "block", marginBottom: 2 }}>HR (bpm)</span>
            <input
              type="number"
              placeholder="Vitals if empty"
              value={d.calculator_hr_bpm}
              onChange={(e) => onPatchForm({ calculator_hr_bpm: e.target.value })}
              style={ecgInputStyle}
            />
          </div>
        </div>
        {!qtcResult && <span style={{ color: "var(--text-30)", fontSize: 10 }}>Enter QT and HR to compute.</span>}
        {qtcResult && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: qtcBandColor(qtcResult.band) }}>
              {Math.round(qtcResult.qtc)} ms
            </div>
            <div style={{ fontSize: 10, marginTop: 4 }}>
              {qtcResult.band} · HR {qtcResult.hrUsed} bpm
            </div>
            {qtDrugWarning && (
              <div style={{ marginTop: 6, color: "rgba(255,149,0,0.95)", fontSize: 10 }}>
                QT-active medication listed — correlate with tracing and K+.
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          padding: "10px 12px",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--glass-border)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="text-caption" style={{ fontSize: 8, color: "var(--text-30)", marginBottom: 6 }}>
          CHA₂DS₂-VASc (AF context)
        </div>
        {!cha && <span style={{ color: "var(--text-30)", fontSize: 10 }}>Enter age in Demographics.</span>}
        {cha && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--scan-400)" }}>{cha.score}</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>{cha.text}</div>
          </div>
        )}
      </div>

      <div
        style={{
          padding: "10px 12px",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--glass-border)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="text-caption" style={{ fontSize: 8, color: "var(--text-30)", marginBottom: 6 }}>
          BMI (optional)
        </div>
        {bmi === null && <span style={{ color: "var(--text-30)", fontSize: 10 }}>Height + weight in Medical history.</span>}
        {bmi !== null && <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-100)" }}>{bmi} kg/m²</div>}
      </div>
    </div>
  );
}
