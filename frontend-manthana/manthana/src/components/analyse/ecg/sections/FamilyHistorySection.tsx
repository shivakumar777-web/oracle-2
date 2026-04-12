"use client";

import React from "react";
import type { EcgFormData } from "@/lib/analyse/ecgPatientContext";
import { EcgFieldGrid, EcgLabel, ecgInputStyle } from "../ecgFieldPrimitives";

export default function FamilyHistorySection({
  data,
  onChange,
  compact,
}: {
  data: EcgFormData["family_history"];
  onChange: (p: Partial<EcgFormData["family_history"]>) => void;
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
        {row("Premature CAD", data.premature_cad, (v) => onChange({ premature_cad: v }))}
        {data.premature_cad && (
          <div>
            <EcgLabel>DETAILS (relation, age at event)</EcgLabel>
            <input
              placeholder="e.g. Father MI at 48"
              value={data.premature_cad_details}
              onChange={(e) => onChange({ premature_cad_details: e.target.value })}
              style={ecgInputStyle}
            />
          </div>
        )}
        {row("Sudden cardiac death", data.sudden_cardiac_death, (v) => onChange({ sudden_cardiac_death: v }))}
        {row(
          "HCM / cardiomyopathy",
          data.hcm_or_cardiomyopathy,
          (v) => onChange({ hcm_or_cardiomyopathy: v }),
          "South Asian founder mutations — correlate with voltage / strain"
        )}
        {row("Familial hypercholesterolemia", data.familial_hypercholesterolemia, (v) =>
          onChange({ familial_hypercholesterolemia: v })
        )}
        {row("Long QT / channelopathy", data.long_qt_or_channelopathy, (v) =>
          onChange({ long_qt_or_channelopathy: v })
        )}
        {row("Rheumatic heart disease", data.rheumatic_heart_disease, (v) =>
          onChange({ rheumatic_heart_disease: v })
        )}
        {row("Hypertension", data.hypertension, (v) => onChange({ hypertension: v }))}
        {row("Diabetes", data.diabetes, (v) => onChange({ diabetes: v }))}
      </div>
    </EcgFieldGrid>
  );
}
