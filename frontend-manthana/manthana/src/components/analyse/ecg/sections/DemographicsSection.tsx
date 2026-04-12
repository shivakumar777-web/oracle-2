"use client";

import React from "react";
import type { EcgFormData } from "@/lib/analyse/ecgPatientContext";
import { INDIAN_STATES } from "@/lib/analyse/ecgFormConfig";
import { EcgFieldGrid, EcgLabel, ecgInputStyle, ecgSelectStyle } from "../ecgFieldPrimitives";

const OCC_PRESETS = [
  "",
  "Software / IT (sedentary)",
  "Agriculture",
  "Manual labor",
  "Student",
  "Retired",
  "Healthcare worker",
  "Other",
];

export default function DemographicsSection({
  data,
  onChange,
  compact,
}: {
  data: EcgFormData["demographics"];
  onChange: (p: Partial<EcgFormData["demographics"]>) => void;
  compact: boolean;
}) {
  return (
    <EcgFieldGrid compact={compact}>
      <div>
        <EcgLabel hint="Required for age-stratified ECG interpretation (Indian premature CAD context).">
          AGE (years)
        </EcgLabel>
        <input
          type="number"
          min={0}
          max={120}
          placeholder="e.g. 52"
          value={data.age}
          onChange={(e) => onChange({ age: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
      <div>
        <EcgLabel hint="Required. QTc thresholds differ by sex.">SEX</EcgLabel>
        <select
          value={data.sex}
          onChange={(e) => onChange({ sex: e.target.value })}
          style={ecgSelectStyle}
        >
          <option value="">Select</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <EcgLabel hint="Regional epidemiology (e.g. RHD, air pollution, TB) may be highlighted in the report.">
          STATE / REGION
        </EcgLabel>
        <select
          value={data.state_region}
          onChange={(e) => onChange({ state_region: e.target.value })}
          style={ecgSelectStyle}
        >
          <option value="">Not specified</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <EcgLabel>URBAN / RURAL</EcgLabel>
        <select
          value={data.urban_rural}
          onChange={(e) => onChange({ urban_rural: e.target.value })}
          style={ecgSelectStyle}
        >
          <option value="">Not specified</option>
          <option value="urban">Urban</option>
          <option value="rural">Rural</option>
        </select>
      </div>
      <div>
        <EcgLabel>OCCUPATION</EcgLabel>
        <select
          value={OCC_PRESETS.includes(data.occupation) ? data.occupation : "Other"}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ occupation: v === "Other" ? "" : v });
          }}
          style={ecgSelectStyle}
        >
          {OCC_PRESETS.map((o) => (
            <option key={o || "ns"} value={o}>
              {o || "Type custom below…"}
            </option>
          ))}
        </select>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <EcgLabel hint="If you chose Other, describe occupation here.">OCCUPATION (custom)</EcgLabel>
        <input
          type="text"
          placeholder="e.g. Cab driver, night shifts"
          value={OCC_PRESETS.includes(data.occupation) ? "" : data.occupation}
          onChange={(e) => onChange({ occupation: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
      <p
        className="font-body"
        style={{ gridColumn: "1 / -1", fontSize: 9, color: "var(--text-30)", margin: 0, fontStyle: "italic" }}
      >
        All AI interpretation outputs are in English only.
      </p>
    </EcgFieldGrid>
  );
}
