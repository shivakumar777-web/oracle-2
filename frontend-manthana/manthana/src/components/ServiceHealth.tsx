"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getHealth, type HealthResponse, type HealthService } from "@/lib/api";

/** Product surfaces shown in the sidebar (labels + health resolution). */
const SERVICE_ROWS: readonly {
  id: string;
  label: string;
  keys: readonly string[];
}[] = [
  {
    id: "oracle",
    label: "Oracle",
    keys: ["oracle", "nlp", "radiology", "ecg"],
  },
  {
    id: "labs",
    label: "Labs",
    keys: ["labs", "radiology", "ecg", "eye"],
  },
  {
    id: "web",
    label: "Web",
    keys: ["web", "ayurveda", "drug", "nlp"],
  },
  {
    id: "deep",
    label: "Deep Research",
    keys: ["deep_research", "brain", "cancer", "nlp"],
  },
] as const;

function pickService(
  services: Record<string, HealthService>,
  keys: readonly string[]
): HealthService {
  for (const k of keys) {
    const s = services[k];
    if (s) return s;
  }
  return { status: "down" };
}

const STATUS_TONE: Record<HealthService["status"], string> = {
  healthy: "text-emerald-400",
  degraded: "text-amber-400",
  down: "text-red-500",
};

export default function ServiceHealth({ expanded }: { expanded: boolean }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const h = await getHealth();
        setHealth(h);
      } catch {
        /* silent */
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const rows = useMemo(() => {
    if (!health) return null;
    return SERVICE_ROWS.map((row) => ({
      ...row,
      svc: pickService(health.services, row.keys),
    }));
  }, [health]);

  if (!rows) return null;

  return (
    <div
      className={`px-1.5 sm:px-2 pb-3 sm:pb-4 ${expanded ? "" : "flex flex-col items-center gap-1.5"}`}
    >
      {expanded && (
        <p className="font-ui text-[7px] sm:text-[8px] text-cream/20 tracking-[0.35em] sm:tracking-[0.5em] uppercase px-1.5 mb-1.5 sm:mb-2">
          Services
        </p>
      )}
      {rows.map((row, i) => {
        const status = row.svc.status;
        const toneClass = STATUS_TONE[status] ?? STATUS_TONE.down;
        const ms = row.svc.latency_ms;
        return (
          <div
            key={row.id}
            className={`flex items-center gap-2 min-w-0 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md ${
              expanded ? "" : "justify-center"
            }`}
            title={`${row.label}: ${status}${ms != null ? ` (${ms}ms)` : ""}`}
          >
            <span
              className={`relative inline-flex h-2 w-2 shrink-0 ${toneClass}`}
              aria-hidden
            >
              <span
                className="service-health-dot absolute inset-0 rounded-full bg-current"
                style={{ animationDelay: `${i * 0.42}s` }}
              />
            </span>
            {expanded && (
              <>
                <span
                  className={`font-ui text-[9px] sm:text-[10px] text-cream/40 flex-1 min-w-0 truncate`}
                >
                  {row.label}
                </span>
                {ms != null && (
                  <span className="font-ui text-[8px] sm:text-[9px] text-cream/20 tabular-nums shrink-0">
                    {ms}ms
                  </span>
                )}
              </>
            )}
            {!expanded && (
              <span className="sr-only">
                {row.label}: {status}
                {ms != null ? ` ${ms}ms` : ""}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
