"use client";

import React from "react";
import type { EcgFormData } from "@/lib/analyse/ecgPatientContext";
import { EcgFieldGrid, EcgLabel, ecgInputStyle, ecgSelectStyle } from "../ecgFieldPrimitives";

const INDICATIONS = [
  "",
  "Chest pain workup",
  "Routine screening",
  "Pre-op",
  "Arrhythmia evaluation",
  "Follow-up",
  "Other",
];

export default function ECGContextSection({
  data,
  onChange,
  compact,
}: {
  data: EcgFormData["ecg_context"];
  onChange: (p: Partial<EcgFormData["ecg_context"]>) => void;
  compact: boolean;
}) {
  return (
    <EcgFieldGrid compact={compact}>
      <div style={{ gridColumn: "1 / -1" }}>
        <EcgLabel>ECG INDICATION</EcgLabel>
        <select
          value={INDICATIONS.includes(data.ecg_indication) ? data.ecg_indication : "__custom__"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") onChange({ ecg_indication: "" });
            else onChange({ ecg_indication: v });
          }}
          style={ecgSelectStyle}
        >
          {INDICATIONS.map((x) => (
            <option key={x || "ns"} value={x}>
              {x || "Select"}
            </option>
          ))}
          <option value="__custom__">Other</option>
        </select>
      </div>
      {!INDICATIONS.includes(data.ecg_indication) && (
        <div style={{ gridColumn: "1 / -1" }}>
          <EcgLabel>INDICATION (custom)</EcgLabel>
          <input
            value={data.ecg_indication}
            onChange={(e) => onChange({ ecg_indication: e.target.value })}
            style={ecgInputStyle}
          />
        </div>
      )}
      <div>
        <EcgLabel>TIME OF ECG</EcgLabel>
        <input
          type="time"
          value={data.time_of_ecg}
          onChange={(e) => onChange({ time_of_ecg: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
      <div>
        <EcgLabel>SERIAL ECG #</EcgLabel>
        <input
          type="number"
          min={1}
          placeholder="1"
          value={data.serial_ecg_number}
          onChange={(e) => onChange({ serial_ecg_number: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={{ fontSize: 11, color: "var(--text-55)", display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={data.is_serial_comparison}
            onChange={(e) => onChange({ is_serial_comparison: e.target.checked })}
          />
          Serial comparison intended (interpret alongside prior ECG when available)
        </label>
        <p style={{ fontSize: 9, color: "var(--text-30)", margin: "6px 0 0", fontStyle: "italic" }}>
          Upload prior tracing as a separate analysis if needed — this flag tells the AI to weight comparison.
        </p>
      </div>
    </EcgFieldGrid>
  );
}
