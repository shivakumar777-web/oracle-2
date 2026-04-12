"use client";

import React from "react";
import type { EcgFormData } from "@/lib/analyse/ecgPatientContext";
import { EcgFieldGrid, EcgLabel, ecgInputStyle } from "../ecgFieldPrimitives";

export default function LabValuesSection({
  data,
  onChange,
  compact,
}: {
  data: EcgFormData["lab_values_if_available"];
  onChange: (p: Partial<EcgFormData["lab_values_if_available"]>) => void;
  compact: boolean;
}) {
  const f = (key: keyof EcgFormData["lab_values_if_available"], label: string, hint?: string) => (
    <div>
      <EcgLabel hint={hint}>{label}</EcgLabel>
      <input
        value={String(data[key] ?? "")}
        onChange={(e) => onChange({ [key]: e.target.value } as Partial<EcgFormData["lab_values_if_available"]>)}
        style={ecgInputStyle}
      />
    </div>
  );

  const troponin = parseFloat(data.troponin_i_ng_ml);
  const troponinHigh = Number.isFinite(troponin) && troponin > 0.04;

  return (
    <div>
      {troponinHigh && (
        <div
          style={{
            marginBottom: 10,
            padding: "8px 10px",
            borderRadius: "var(--r-sm)",
            border: "1px solid rgba(255,80,80,0.5)",
            background: "rgba(255,80,80,0.08)",
            fontSize: 11,
          }}
        >
          Elevated troponin entered — ensure clinical correlation and local assay reference range.
        </div>
      )}
      <EcgFieldGrid compact={compact}>
        {f("hemoglobin_g_dl", "HEMOGLOBIN (g/dL)")}
        {f("serum_potassium_meq_l", "K+ (mEq/L)", "Critical for QT / U waves")}
        {f("serum_sodium_meq_l", "Na+ (mEq/L)")}
        {f("creatinine_mg_dl", "CREATININE (mg/dL)")}
        {f("tsh_uiu_ml", "TSH (µIU/mL)")}
        {f("hba1c_percent", "HbA1c (%)")}
        {f("total_cholesterol_mg_dl", "TOTAL CHOL (mg/dL)")}
        {f("ldl_mg_dl", "LDL (mg/dL)")}
        {f("hdl_mg_dl", "HDL (mg/dL)", "Low HDL common in South Asians — metabolic risk")}
        {f("triglycerides_mg_dl", "TRIGLYCERIDES (mg/dL)")}
        {f("troponin_i_ng_ml", "TROPONIN I (ng/mL)")}
        {f("bnp_or_nt_pro_bnp", "BNP / NT-proBNP")}
        {f("d_dimer", "D-DIMER")}
        {f("magnesium", "MAGNESIUM")}
      </EcgFieldGrid>
    </div>
  );
}
