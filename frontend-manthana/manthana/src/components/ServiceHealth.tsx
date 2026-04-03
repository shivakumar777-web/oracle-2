"use client";

import React, { useEffect, useState } from "react";
import { getHealth, HealthResponse } from "@/lib/api";

const SERVICE_LABELS: Record<string, string> = {
  ecg: "ECG",
  ayurveda: "Ayurveda",
  nlp: "NLP",
  cancer: "Oncology",
  drug: "Drug DB",
  eye: "Ophthalmology",
  brain: "Neuro",
};

export default function ServiceHealth({ expanded }: { expanded: boolean }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const h = await getHealth();
        setHealth(h);
      } catch { /* silent */ }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  if (!health) return null;

  const DOT_COLORS = {
    healthy: "bg-emerald-400",
    degraded: "bg-amber-400",
    down: "bg-red-500",
  };

  return (
    <div className={`px-2 pb-4 ${expanded ? "" : "flex flex-col items-center gap-1"}`}>
      {expanded && (
        <p className="font-ui text-[8px] text-cream/20 tracking-[0.5em] uppercase px-2 mb-2">
          Services
        </p>
      )}
      {Object.entries(SERVICE_LABELS).map(([key, label]) => {
        const svc = health.services[key];
        const status = svc?.status ?? "down";
        return (
          <div
            key={key}
            className={`flex items-center gap-2.5 px-2 py-1 rounded-md ${expanded ? "" : "justify-center"}`}
            title={`${label}: ${status}${svc?.latency_ms ? ` (${svc.latency_ms}ms)` : ""}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_COLORS[status as keyof typeof DOT_COLORS] ?? DOT_COLORS.down}`} />
            {expanded && (
              <span className="font-ui text-[10px] text-cream/35 flex-1">{label}</span>
            )}
            {expanded && svc?.latency_ms && (
              <span className="font-ui text-[9px] text-cream/15">{svc.latency_ms}ms</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
