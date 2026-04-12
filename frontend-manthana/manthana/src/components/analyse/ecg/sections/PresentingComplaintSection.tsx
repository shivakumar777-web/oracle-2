"use client";

import React from "react";
import type { EcgFormData } from "@/lib/analyse/ecgPatientContext";
import { EcgFieldGrid, EcgLabel, ecgInputStyle, ecgSelectStyle } from "../ecgFieldPrimitives";

const CHIEF = [
  "",
  "Chest pain",
  "Palpitations",
  "Shortness of breath",
  "Dizziness / syncope",
  "Routine check",
  "Pre-op evaluation",
];
const DURATION = [
  "",
  "Acute (<1 hour)",
  "Subacute (1–24 hours)",
  "Persistent (>24 hours)",
  "Chronic (days–weeks)",
  "Intermittent",
];
const CHARACTER = ["", "Crushing / pressure", "Stabbing", "Burning", "Aching", "None"];
const ONSET = ["", "Sudden", "Gradual", "Exertional", "At rest", "Postprandial"];
const ASSOC = ["Sweating", "Nausea / vomiting", "Radiation to arm / jaw", "Dyspnea", "Palpitations", "None"];

export default function PresentingComplaintSection({
  data,
  onChange,
  compact,
}: {
  data: EcgFormData["presenting_complaint"];
  onChange: (p: Partial<EcgFormData["presenting_complaint"]>) => void;
  compact: boolean;
}) {
  const toggleAssoc = (label: string) => {
    const set = new Set(data.associated_symptoms);
    if (set.has(label)) set.delete(label);
    else set.add(label);
    onChange({ associated_symptoms: Array.from(set) });
  };

  return (
    <EcgFieldGrid compact={compact}>
      <div style={{ gridColumn: "1 / -1" }}>
        <EcgLabel>CHIEF COMPLAINT</EcgLabel>
        <select
          value={CHIEF.includes(data.chief_complaint) ? data.chief_complaint : "__custom__"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") onChange({ chief_complaint: "" });
            else onChange({ chief_complaint: v });
          }}
          style={ecgSelectStyle}
        >
          {CHIEF.map((x) => (
            <option key={x || "ns"} value={x}>
              {x || "Select"}
            </option>
          ))}
          <option value="__custom__">Other (type below)</option>
        </select>
      </div>
      {!CHIEF.includes(data.chief_complaint) && (
        <div style={{ gridColumn: "1 / -1" }}>
          <EcgLabel>CHIEF COMPLAINT (custom)</EcgLabel>
          <input
            style={ecgInputStyle}
            placeholder="Describe complaint"
            value={data.chief_complaint}
            onChange={(e) => onChange({ chief_complaint: e.target.value })}
          />
        </div>
      )}
      <div>
        <EcgLabel>DURATION</EcgLabel>
        <select
          value={data.duration}
          onChange={(e) => onChange({ duration: e.target.value })}
          style={ecgSelectStyle}
        >
          {DURATION.map((x) => (
            <option key={x || "ns"} value={x}>
              {x || "Select"}
            </option>
          ))}
        </select>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <EcgLabel>CHARACTER</EcgLabel>
        <select
          value={CHARACTER.includes(data.character) ? data.character : "__custom__"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") onChange({ character: "" });
            else onChange({ character: v });
          }}
          style={ecgSelectStyle}
        >
          {CHARACTER.map((x) => (
            <option key={x || "ns"} value={x}>
              {x || "Select"}
            </option>
          ))}
          <option value="__custom__">Other (type below)</option>
        </select>
      </div>
      {!CHARACTER.includes(data.character) && (
        <div style={{ gridColumn: "1 / -1" }}>
          <EcgLabel>CHARACTER (custom)</EcgLabel>
          <input
            style={ecgInputStyle}
            value={data.character}
            onChange={(e) => onChange({ character: e.target.value })}
          />
        </div>
      )}
      <div>
        <EcgLabel>ONSET</EcgLabel>
        <select
          value={data.onset}
          onChange={(e) => onChange({ onset: e.target.value })}
          style={ecgSelectStyle}
        >
          {ONSET.map((x) => (
            <option key={x || "ns"} value={x}>
              {x || "Select"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <EcgLabel>EXERTIONAL VS REST</EcgLabel>
        <select
          value={data.exertional_or_rest}
          onChange={(e) => onChange({ exertional_or_rest: e.target.value })}
          style={ecgSelectStyle}
        >
          <option value="">Not specified</option>
          <option value="exertional">Exertional</option>
          <option value="rest">Rest</option>
          <option value="both">Both</option>
        </select>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <EcgLabel>ASSOCIATED SYMPTOMS</EcgLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ASSOC.map((a) => (
            <label
              key={a}
              style={{ fontSize: 11, color: "var(--text-55)", display: "flex", alignItems: "center", gap: 4 }}
            >
              <input type="checkbox" checked={data.associated_symptoms.includes(a)} onChange={() => toggleAssoc(a)} />
              {a}
            </label>
          ))}
        </div>
      </div>
    </EcgFieldGrid>
  );
}
