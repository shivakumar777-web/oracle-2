"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_SOURCE_IMAGE_BYTES,
  MANTHANA_REPORT_ENGINE_HANDOFF_PREFIX,
  MANTHANA_REPORT_ENGINE_STORAGE_KEY,
  type ReportEngineSessionPayload,
} from "@/lib/analyse/report-engine-mapper";

export type ReportEnginePhase = "idle" | "connecting" | "ready";

export function fileToDataUrl(file: File, maxBytes = MAX_SOURCE_IMAGE_BYTES): Promise<string | null> {
  if (file.size > maxBytes) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      resolve(typeof r.result === "string" ? r.result : null);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function statusLines(modalityLabel: string): string[] {
  const m = modalityLabel || "study";
  return [
    `Manthana · ${m} · engine — contacting…`,
    "Establishing secure channel…",
    "Loading modality weights…",
    "Resolving report layout…",
    "Preparing professional HTML export…",
    "Almost ready…",
  ];
}

export function useReportEngineLaunch(modalityLabel: string) {
  const [phase, setPhase] = useState<ReportEnginePhase>("idle");
  const [statusLine, setStatusLine] = useState("");
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (rotateRef.current) {
      clearInterval(rotateRef.current);
      rotateRef.current = null;
    }
    if (doneRef.current) {
      clearTimeout(doneRef.current);
      doneRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const startGpuSequence = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("connecting");
    const lines = statusLines(modalityLabel);
    let i = 0;
    setStatusLine(lines[0] ?? "");
    rotateRef.current = setInterval(() => {
      i = (i + 1) % lines.length;
      setStatusLine(lines[i] ?? "");
    }, 2200);
    const durationMs = 10_000 + Math.random() * 20_000;
    doneRef.current = setTimeout(() => {
      clearTimers();
      setPhase("ready");
      setStatusLine("Report layout ready — open the HTML engine when you are.");
    }, durationMs);
  }, [phase, modalityLabel, clearTimers]);

  const openReportEngine = useCallback(
    (buildPayload: () => ReportEngineSessionPayload | Promise<ReportEngineSessionPayload>) => {
      if (phase !== "ready") return;
      void (async () => {
        try {
          const payload = await buildPayload();
          const handoffId =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `h_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
          const handoffStorageKey = `${MANTHANA_REPORT_ENGINE_HANDOFF_PREFIX}${handoffId}`;

          const stripImage = (p: ReportEngineSessionPayload): ReportEngineSessionPayload => ({
            ...p,
            enginePayload: {
              ...p.enginePayload,
              source_media: undefined,
            },
          });

          const json = JSON.stringify(payload);
          const jsonNoImage = JSON.stringify(stripImage(payload));

          /** New tab does not inherit sessionStorage; use one-time localStorage + ?handoff= */
          let handoffStored = false;
          try {
            localStorage.setItem(handoffStorageKey, json);
            handoffStored = true;
          } catch {
            try {
              localStorage.setItem(handoffStorageKey, jsonNoImage);
              handoffStored = true;
            } catch {
              handoffStored = false;
            }
          }

          try {
            sessionStorage.setItem(MANTHANA_REPORT_ENGINE_STORAGE_KEY, json);
          } catch {
            try {
              sessionStorage.setItem(MANTHANA_REPORT_ENGINE_STORAGE_KEY, jsonNoImage);
            } catch {
              /* ignore */
            }
          }

          const path = "/manthana_report_engine.html";
          const base = new URL(path, window.location.origin);

          if (handoffStored) {
            base.searchParams.set("handoff", handoffId);
            window.open(base.toString(), "_blank", "noopener,noreferrer");
          } else {
            /** Private mode / storage blocked: deliver payload via postMessage (no noopener). */
            const child = window.open(`${base.origin}${base.pathname}?pm=1`, "_blank");
            if (child) {
              const deliver = () => {
                try {
                  child.postMessage(
                    { type: "manthana_report_engine_v1", payload },
                    window.location.origin
                  );
                } catch {
                  /* ignore */
                }
              };
              setTimeout(deliver, 0);
              setTimeout(deliver, 400);
              setTimeout(deliver, 1200);
            }
          }
        } finally {
          setPhase("idle");
          setStatusLine("");
        }
      })();
    },
    [phase]
  );

  const reset = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setStatusLine("");
  }, [clearTimers]);

  return {
    phase,
    statusLine,
    startGpuSequence,
    openReportEngine,
    reset,
  };
}
