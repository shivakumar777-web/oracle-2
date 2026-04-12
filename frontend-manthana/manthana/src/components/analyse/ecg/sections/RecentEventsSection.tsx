"use client";

import React from "react";
import type { EcgFormData } from "@/lib/analyse/ecgPatientContext";
import { EcgFieldGrid, EcgLabel, ecgInputStyle } from "../ecgFieldPrimitives";

export default function RecentEventsSection({
  data,
  onChange,
  compact,
}: {
  data: EcgFormData["recent_events"];
  onChange: (p: Partial<EcgFormData["recent_events"]>) => void;
  compact: boolean;
}) {
  const row = (label: string, checked: boolean, on: (v: boolean) => void) => (
    <label style={{ fontSize: 11, color: "var(--text-55)", display: "flex", alignItems: "center", gap: 6 }}>
      <input type="checkbox" checked={checked} onChange={(e) => on(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <EcgFieldGrid compact={compact}>
      <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
        {row("Recent illness", data.recent_illness, (v) => onChange({ recent_illness: v }))}
        {data.recent_illness && (
          <input
            placeholder="Describe"
            value={data.recent_illness_detail}
            onChange={(e) => onChange({ recent_illness_detail: e.target.value })}
            style={ecgInputStyle}
          />
        )}
        {row("Recent viral fever", data.recent_viral_fever, (v) => onChange({ recent_viral_fever: v }))}
        {row("Recent surgery", data.recent_surgery, (v) => onChange({ recent_surgery: v }))}
        {data.recent_surgery && (
          <input
            type="date"
            value={data.recent_surgery_date}
            onChange={(e) => onChange({ recent_surgery_date: e.target.value })}
            style={ecgInputStyle}
          />
        )}
        {row("Recent hospitalization", data.recent_hospitalization, (v) =>
          onChange({ recent_hospitalization: v })
        )}
        {row("Long travel (>4h) — PE risk context", data.recent_long_travel, (v) =>
          onChange({ recent_long_travel: v })
        )}
        {row("Recent immobilization", data.recent_immobilization, (v) =>
          onChange({ recent_immobilization: v })
        )}
        {row("COVID history", data.covid_history, (v) => onChange({ covid_history: v }))}
        {data.covid_history && (
          <div>
            <EcgLabel>YEAR</EcgLabel>
            <input
              value={data.covid_year}
              onChange={(e) => onChange({ covid_year: e.target.value })}
              style={ecgInputStyle}
              placeholder="e.g. 2022"
            />
          </div>
        )}
      </div>
    </EcgFieldGrid>
  );
}
