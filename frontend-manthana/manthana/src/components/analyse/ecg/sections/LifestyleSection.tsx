"use client";

import React from "react";
import type { EcgFormData } from "@/lib/analyse/ecgPatientContext";
import { EcgFieldGrid, EcgLabel, ecgInputStyle, ecgSelectStyle } from "../ecgFieldPrimitives";

const DIET_TAGS = [
  "High refined carbohydrate",
  "High oil / fried food",
  "High fiber",
  "Balanced",
  "Diabetic diet",
  "Heart healthy",
];

export default function LifestyleSection({
  data,
  onChange,
  compact,
}: {
  data: EcgFormData["lifestyle"];
  onChange: (p: Partial<EcgFormData["lifestyle"]>) => void;
  compact: boolean;
}) {
  const toggleDiet = (t: string) => {
    const s = new Set(data.diet_pattern);
    if (s.has(t)) s.delete(t);
    else s.add(t);
    onChange({ diet_pattern: Array.from(s) });
  };

  return (
    <EcgFieldGrid compact={compact}>
      <div>
        <EcgLabel>SMOKING</EcgLabel>
        <select
          value={data.smoking_status}
          onChange={(e) => onChange({ smoking_status: e.target.value })}
          style={ecgSelectStyle}
        >
          <option value="">Not specified</option>
          <option value="never">Never</option>
          <option value="current">Current</option>
          <option value="ex-smoker">Ex-smoker</option>
        </select>
      </div>
      {(data.smoking_status === "current" || data.smoking_status === "ex-smoker") && (
        <>
          <div>
            <EcgLabel>PACK-YEARS</EcgLabel>
            <input
              value={data.smoking_pack_years}
              onChange={(e) => onChange({ smoking_pack_years: e.target.value })}
              style={ecgInputStyle}
            />
          </div>
          {data.smoking_status === "ex-smoker" && (
            <div>
              <EcgLabel>QUIT YEAR</EcgLabel>
              <input
                value={data.smoking_quit_year}
                onChange={(e) => onChange({ smoking_quit_year: e.target.value })}
                style={ecgInputStyle}
              />
            </div>
          )}
        </>
      )}
      <div>
        <EcgLabel>ALCOHOL</EcgLabel>
        <select
          value={data.alcohol}
          onChange={(e) => onChange({ alcohol: e.target.value })}
          style={ecgSelectStyle}
        >
          <option value="">Not specified</option>
          <option value="never">Never</option>
          <option value="occasional">Occasional</option>
          <option value="regular">Regular</option>
        </select>
      </div>
      {(data.alcohol === "occasional" || data.alcohol === "regular") && (
        <div>
          <EcgLabel>UNITS / WEEK</EcgLabel>
          <input
            value={data.alcohol_units_per_week}
            onChange={(e) => onChange({ alcohol_units_per_week: e.target.value })}
            style={ecgInputStyle}
          />
        </div>
      )}
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 11, color: "var(--text-55)", display: "flex", gap: 6 }}>
          <input
            type="checkbox"
            checked={data.tobacco_chewing}
            onChange={(e) => onChange({ tobacco_chewing: e.target.checked })}
          />
          Tobacco chewing
        </label>
        <label style={{ fontSize: 11, color: "var(--text-55)", display: "flex", gap: 6 }}>
          <input
            type="checkbox"
            checked={data.betel_nut_use}
            onChange={(e) => onChange({ betel_nut_use: e.target.checked })}
          />
          Betel nut
        </label>
      </div>
      <div>
        <EcgLabel>PHYSICAL ACTIVITY</EcgLabel>
        <select
          value={data.physical_activity}
          onChange={(e) => onChange({ physical_activity: e.target.value })}
          style={ecgSelectStyle}
        >
          <option value="">Not specified</option>
          <option value="sedentary">Sedentary</option>
          <option value="light">Light</option>
          <option value="moderate">Moderate</option>
          <option value="heavy">Heavy</option>
        </select>
      </div>
      <div>
        <EcgLabel>DIET TYPE</EcgLabel>
        <select
          value={data.diet_type}
          onChange={(e) => onChange({ diet_type: e.target.value })}
          style={ecgSelectStyle}
        >
          <option value="">Not specified</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="eggetarian">Eggetarian</option>
          <option value="non-vegetarian">Non-vegetarian</option>
          <option value="vegan">Vegan</option>
        </select>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <EcgLabel>DIET PATTERN (multi)</EcgLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {DIET_TAGS.map((t) => (
            <label key={t} style={{ fontSize: 11, color: "var(--text-55)", display: "flex", gap: 4 }}>
              <input type="checkbox" checked={data.diet_pattern.includes(t)} onChange={() => toggleDiet(t)} />
              {t}
            </label>
          ))}
        </div>
      </div>
      <div>
        <EcgLabel>STRESS</EcgLabel>
        <select
          value={data.stress_level}
          onChange={(e) => onChange({ stress_level: e.target.value })}
          style={ecgSelectStyle}
        >
          <option value="">Not specified</option>
          <option value="low">Low</option>
          <option value="moderate">Moderate</option>
          <option value="high">High</option>
        </select>
      </div>
      <div>
        <EcgLabel>SLEEP (hours)</EcgLabel>
        <input
          type="number"
          step="0.5"
          placeholder="0–24"
          value={data.sleep_hours}
          onChange={(e) => onChange({ sleep_hours: e.target.value })}
          style={ecgInputStyle}
        />
      </div>
    </EcgFieldGrid>
  );
}
