"use client";

import React from "react";
import type { EcgFormData } from "@/lib/analyse/ecgPatientContext";
import { EcgFieldGrid, EcgLabel, ecgInputStyle } from "../ecgFieldPrimitives";

export default function VitalsSection({
  data,
  onChange,
  compact,
}: {
  data: EcgFormData["vitals_at_presentation"];
  onChange: (p: Partial<EcgFormData["vitals_at_presentation"]>) => void;
  compact: boolean;
}) {
  return (
    <EcgFieldGrid compact={compact}>
      <div>
        <EcgLabel hint="mmHg">BP SYSTOLIC</EcgLabel>
        <input
          type="number"
          inputMode="numeric"
          placeholder="70–250"
          value={data.bp_systolic}
          onChange={(e) => onChange({ bp_systolic: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
      <div>
        <EcgLabel hint="mmHg">BP DIASTOLIC</EcgLabel>
        <input
          type="number"
          inputMode="numeric"
          placeholder="40–150"
          value={data.bp_diastolic}
          onChange={(e) => onChange({ bp_diastolic: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
      <div>
        <EcgLabel hint="Can differ slightly from ECG rate">HEART RATE (bpm)</EcgLabel>
        <input
          type="number"
          inputMode="numeric"
          placeholder="30–220"
          value={data.heart_rate}
          onChange={(e) => onChange({ heart_rate: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
      <div>
        <EcgLabel>SpO₂ (%)</EcgLabel>
        <input
          type="number"
          inputMode="numeric"
          placeholder="70–100"
          value={data.spo2_percent}
          onChange={(e) => onChange({ spo2_percent: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
      <div>
        <EcgLabel>TEMPERATURE (°C)</EcgLabel>
        <input
          type="number"
          inputMode="decimal"
          placeholder="35–42"
          value={data.temperature_celsius}
          onChange={(e) => onChange({ temperature_celsius: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
      <div>
        <EcgLabel>RESPIRATORY RATE (/min)</EcgLabel>
        <input
          type="number"
          inputMode="numeric"
          placeholder="8–40"
          value={data.respiratory_rate}
          onChange={(e) => onChange({ respiratory_rate: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
    </EcgFieldGrid>
  );
}
