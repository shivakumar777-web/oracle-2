"use client";

import React from "react";
import type { EcgFormData } from "@/lib/analyse/ecgPatientContext";
import { EcgFieldGrid, EcgLabel, ecgInputStyle, ecgSelectStyle } from "../ecgFieldPrimitives";

const ARR = ["AF", "VT", "SVT", "Heart block", "None"];

export default function CardiacHistorySection({
  data,
  onChange,
  compact,
}: {
  data: EcgFormData["cardiac_history"];
  onChange: (p: Partial<EcgFormData["cardiac_history"]>) => void;
  compact: boolean;
}) {
  const toggleArr = (x: string) => {
    const s = new Set(data.prior_arrhythmia);
    if (s.has(x)) s.delete(x);
    else s.add(x);
    onChange({ prior_arrhythmia: Array.from(s) });
  };

  const row = (label: string, checked: boolean, on: (v: boolean) => void) => (
    <label style={{ fontSize: 11, color: "var(--text-55)", display: "flex", alignItems: "center", gap: 6 }}>
      <input type="checkbox" checked={checked} onChange={(e) => on(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <EcgFieldGrid compact={compact}>
      <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
        {row("Prior MI", data.prior_mi, (v) => onChange({ prior_mi: v }))}
        {data.prior_mi && (
          <div>
            <EcgLabel>YEAR OF MI</EcgLabel>
            <input
              type="number"
              placeholder="e.g. 2019"
              value={data.prior_mi_year}
              onChange={(e) => onChange({ prior_mi_year: e.target.value })}
              style={ecgInputStyle}
            />
          </div>
        )}
        {row("Prior PCI / CABG", data.prior_pci_cabg, (v) => onChange({ prior_pci_cabg: v }))}
        {row("Known CAD", data.known_cad, (v) => onChange({ known_cad: v }))}
        {row("Heart failure", data.heart_failure, (v) => onChange({ heart_failure: v }))}
        {data.heart_failure && (
          <div>
            <EcgLabel>NYHA CLASS</EcgLabel>
            <select
              value={data.heart_failure_nyha}
              onChange={(e) => onChange({ heart_failure_nyha: e.target.value })}
              style={ecgSelectStyle}
            >
              <option value="">Select</option>
              <option value="I">I</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
            </select>
          </div>
        )}
        {row(
          "Rheumatic fever history (common in India — consider RHD)",
          data.rheumatic_fever_history,
          (v) => onChange({ rheumatic_fever_history: v })
        )}
        {row("Known valve disease", data.known_valve_disease, (v) => onChange({ known_valve_disease: v }))}
        {data.known_valve_disease && (
          <input
            placeholder="Valve / lesion detail"
            value={data.valve_disease_detail}
            onChange={(e) => onChange({ valve_disease_detail: e.target.value })}
            style={ecgInputStyle}
          />
        )}
        {row("Congenital heart disease", data.congenital_heart_disease, (v) =>
          onChange({ congenital_heart_disease: v })
        )}
        {row("Prior ECG available for comparison", data.prior_ecg_available, (v) =>
          onChange({ prior_ecg_available: v })
        )}
        {row("ICD / pacemaker", data.icd_pacemaker, (v) => onChange({ icd_pacemaker: v }))}
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <EcgLabel hint="Select all that apply">PRIOR ARRHYTHMIA</EcgLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ARR.map((a) => (
            <label key={a} style={{ fontSize: 11, color: "var(--text-55)", display: "flex", gap: 4 }}>
              <input type="checkbox" checked={data.prior_arrhythmia.includes(a)} onChange={() => toggleArr(a)} />
              {a}
            </label>
          ))}
        </div>
      </div>
    </EcgFieldGrid>
  );
}
