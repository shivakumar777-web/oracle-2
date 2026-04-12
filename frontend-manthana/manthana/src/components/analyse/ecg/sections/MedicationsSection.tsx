"use client";

import React from "react";
import type { EcgMedicationRow } from "@/lib/analyse/ecgPatientContext";
import { newMedRow } from "@/lib/analyse/ecgPatientContext";
import { COMMON_CARDIAC_MED_SUGGESTIONS, medicationHasQtRisk } from "@/lib/analyse/ecgFormConfig";
import { EcgFieldGrid, EcgLabel, ecgInputStyle } from "../ecgFieldPrimitives";

export default function MedicationsSection({
  data,
  onChange,
  compact,
}: {
  data: EcgMedicationRow[];
  onChange: (rows: EcgMedicationRow[]) => void;
  compact: boolean;
}) {
  const updateRow = (id: string, patch: Partial<EcgMedicationRow>) => {
    onChange(data.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => onChange([...data, newMedRow()]);
  const removeRow = (id: string) => {
    if (data.length <= 1) onChange([{ ...data[0], drug: "", dose: "", frequency: "" }]);
    else onChange(data.filter((r) => r.id !== id));
  };

  const qtFlags = data.filter((r) => r.drug.trim() && medicationHasQtRisk(r.drug));

  return (
    <div>
      {qtFlags.length > 0 && (
        <div
          style={{
            marginBottom: 10,
            padding: "8px 10px",
            borderRadius: "var(--r-sm)",
            border: "1px solid rgba(255,149,0,0.45)",
            background: "rgba(255,149,0,0.08)",
            fontSize: 11,
            color: "var(--text-100)",
          }}
        >
          <strong>QT / conduction caution:</strong> {qtFlags.map((r) => r.drug.trim()).join(", ")} — correlate with
          QTc and electrolytes.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((row) => (
          <div
            key={row.id}
            style={{
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--r-sm)",
              padding: 8,
            }}
          >
            <EcgFieldGrid compact={compact}>
              <div style={{ gridColumn: "1 / -1" }}>
                <EcgLabel>DRUG</EcgLabel>
                <input
                  list="ecg-med-suggestions"
                  value={row.drug}
                  onChange={(e) => updateRow(row.id, { drug: e.target.value })}
                  style={ecgInputStyle}
                  placeholder="e.g. Metformin"
                />
                <datalist id="ecg-med-suggestions">
                  {COMMON_CARDIAC_MED_SUGGESTIONS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                {medicationHasQtRisk(row.drug) && (
                  <span style={{ fontSize: 9, color: "rgba(255,149,0,0.95)", marginTop: 4, display: "block" }}>
                    QT / repolarization risk pattern
                  </span>
                )}
              </div>
              <div>
                <EcgLabel>DOSE</EcgLabel>
                <input
                  value={row.dose}
                  onChange={(e) => updateRow(row.id, { dose: e.target.value })}
                  style={ecgInputStyle}
                  placeholder="500mg"
                />
              </div>
              <div>
                <EcgLabel>FREQUENCY</EcgLabel>
                <input
                  value={row.frequency}
                  onChange={(e) => updateRow(row.id, { frequency: e.target.value })}
                  style={ecgInputStyle}
                  placeholder="BD / OD"
                />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button type="button" className="btn-ghost" style={{ fontSize: 10, padding: "4px 10px" }} onClick={addRow}>
                  + Add drug
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: 10, padding: "4px 10px" }}
                  onClick={() => removeRow(row.id)}
                >
                  Remove
                </button>
              </div>
            </EcgFieldGrid>
          </div>
        ))}
      </div>
    </div>
  );
}
