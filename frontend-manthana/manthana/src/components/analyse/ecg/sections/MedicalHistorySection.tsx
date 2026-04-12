"use client";

import React from "react";
import type { EcgFormData } from "@/lib/analyse/ecgPatientContext";
import { EcgFieldGrid, EcgLabel, ecgInputStyle, ecgSelectStyle } from "../ecgFieldPrimitives";

export default function MedicalHistorySection({
  data,
  onChange,
  compact,
}: {
  data: EcgFormData["medical_history"];
  onChange: (p: Partial<EcgFormData["medical_history"]>) => void;
  compact: boolean;
}) {
  const row = (label: string, checked: boolean, on: (v: boolean) => void, hint?: string) => (
    <label
      title={hint}
      style={{ fontSize: 11, color: "var(--text-55)", display: "flex", alignItems: "center", gap: 6 }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => on(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <EcgFieldGrid compact={compact}>
      <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
        {row("Hypertension", data.hypertension, (v) => onChange({ hypertension: v }))}
        {data.hypertension && (
          <input
            placeholder="Years with HTN"
            value={data.hypertension_years}
            onChange={(e) => onChange({ hypertension_years: e.target.value })}
            style={ecgInputStyle}
          />
        )}
        {row("Diabetes", data.diabetes, (v) => onChange({ diabetes: v }))}
        {data.diabetes && (
          <EcgFieldGrid compact={compact}>
            <div>
              <EcgLabel>TYPE</EcgLabel>
              <select
                value={data.diabetes_type}
                onChange={(e) => onChange({ diabetes_type: e.target.value })}
                style={ecgSelectStyle}
              >
                <option value="">Select</option>
                <option value="Type 1">Type 1</option>
                <option value="Type 2">Type 2</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <EcgLabel>YEARS</EcgLabel>
              <input
                value={data.diabetes_years}
                onChange={(e) => onChange({ diabetes_years: e.target.value })}
                style={ecgInputStyle}
              />
            </div>
          </EcgFieldGrid>
        )}
        {row("Dyslipidemia", data.dyslipidemia, (v) => onChange({ dyslipidemia: v }))}
        {row("CKD", data.ckd, (v) => onChange({ ckd: v }))}
        {data.ckd && (
          <div>
            <EcgLabel>CKD STAGE</EcgLabel>
            <select
              value={data.ckd_stage}
              onChange={(e) => onChange({ ckd_stage: e.target.value })}
              style={ecgSelectStyle}
            >
              <option value="">Select</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3a">3a</option>
              <option value="3b">3b</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
        )}
        {row(
          "COPD / asthma",
          data.copd_asthma,
          (v) => onChange({ copd_asthma: v }),
          "High prevalence in India — RV strain / P pulmonale"
        )}
        {row("Thyroid disorder", data.thyroid_disorder, (v) => onChange({ thyroid_disorder: v }))}
        {data.thyroid_disorder && (
          <input
            placeholder="Hypo / hyper / other"
            value={data.thyroid_type}
            onChange={(e) => onChange({ thyroid_type: e.target.value })}
            style={ecgInputStyle}
          />
        )}
        {row("Stroke / TIA", data.stroke_tia, (v) => onChange({ stroke_tia: v }))}
        {row("Peripheral arterial disease", data.peripheral_arterial_disease, (v) =>
          onChange({ peripheral_arterial_disease: v })
        )}
        {row("Autoimmune disease", data.autoimmune_disease, (v) => onChange({ autoimmune_disease: v }))}
        {row(
          "Tuberculosis history",
          data.tuberculosis_history,
          (v) => onChange({ tuberculosis_history: v }),
          "TB pericarditis — consider with diffuse ECG changes"
        )}
        {row("HIV", data.hiv, (v) => onChange({ hiv: v }))}
        {row("Anemia", data.anemia, (v) => onChange({ anemia: v }))}
        {row("Liver disease", data.liver_disease, (v) => onChange({ liver_disease: v }))}
        {row("Obesity", data.obesity, (v) => onChange({ obesity: v }))}
        {row("Obstructive sleep apnea", data.obstructive_sleep_apnea, (v) =>
          onChange({ obstructive_sleep_apnea: v })
        )}
      </div>
      <div>
        <EcgLabel hint="Optional — BMI auto-calculated in summary panel">HEIGHT (m)</EcgLabel>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="e.g. 1.72"
          value={data.height_m}
          onChange={(e) => onChange({ height_m: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
      <div>
        <EcgLabel>WEIGHT (kg)</EcgLabel>
        <input
          type="number"
          inputMode="decimal"
          placeholder="e.g. 78"
          value={data.weight_kg}
          onChange={(e) => onChange({ weight_kg: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
    </EcgFieldGrid>
  );
}
