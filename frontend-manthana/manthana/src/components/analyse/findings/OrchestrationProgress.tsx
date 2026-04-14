"use client";

import React, { useEffect, useState } from "react";

const STEPS: { label: string; durationMs: number }[] = [
  { label: "Parsing modality context", durationMs: 2000 },
  { label: "Analyzing image features", durationMs: 3000 },
  { label: "Synthesizing structured findings", durationMs: 3000 },
  { label: "Cross-checking clinical safety flags", durationMs: 2500 },
  { label: "Building report sections", durationMs: 2500 },
  { label: "Validating diagnostic reasoning", durationMs: 2000 },
  { label: "Finalizing structured output", durationMs: 0 },
];

const TOTAL_MS = STEPS.slice(0, 6).reduce((s, x) => s + x.durationMs, 0);

export default function OrchestrationProgress() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [barPct, setBarPct] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const start = performance.now();
    let cancelled = false;
    let raf = 0;
    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - start;
      setBarPct(Math.min(100, (elapsed / TOTAL_MS) * 100));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;

    let idx = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const scheduleNext = () => {
      if (idx >= STEPS.length - 1) {
        setActiveIndex(STEPS.length - 1);
        return;
      }
      const d = STEPS[idx].durationMs;
      const t = setTimeout(() => {
        idx += 1;
        setActiveIndex(idx);
        scheduleNext();
      }, d);
      timers.push(t);
    };

    setActiveIndex(0);
    scheduleNext();

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: 20,
          textAlign: "center",
          borderRadius: 12,
          border: "1px solid rgba(0,180,255,0.18)",
          background: "rgba(10,21,32,0.96)",
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}
      >
        <div
          className="orchestration-progress-spinner"
          style={{
            width: 40,
            height: 40,
            margin: "0 auto 12px",
            border: "2px solid rgba(0,212,255,0.35)",
            borderTopColor: "#00d4ff",
            borderRadius: "50%",
          }}
        />
        <p style={{ fontSize: 13, color: "#7ab3cc", margin: 0 }}>Generating structured report…</p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Report generation pipeline"
      style={{
        padding: 18,
        borderRadius: 12,
        border: "1px solid rgba(0,180,255,0.18)",
        background: "rgba(10,21,32,0.96)",
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          height: 4,
          borderRadius: 4,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${barPct}%`,
            maxWidth: "100%",
            borderRadius: 4,
            background: "linear-gradient(90deg, #00d4ff, #00ffcc)",
            transition: "width 0.15s linear",
          }}
        />
      </div>

      <p
        style={{
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#4a8fa8",
          margin: "0 0 12px",
        }}
      >
        Structured report pipeline
      </p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {STEPS.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={step.label}
              aria-label={`${step.label}${done ? ", complete" : active ? ", in progress" : ", pending"}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                marginBottom: 4,
                borderRadius: 8,
                borderLeft: active ? "2px solid var(--scan-500, #00c4b0)" : "2px solid transparent",
                background: active ? "rgba(0,196,176,0.06)" : "transparent",
                opacity: done ? 0.55 : 1,
              }}
            >
              <span
                style={{
                  fontFamily: "'DM Mono', ui-monospace, monospace",
                  fontSize: 10,
                  color: done ? "#00e87a" : active ? "#00d4ff" : "#3d6678",
                  width: 20,
                  flexShrink: 0,
                  textAlign: "center",
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: active ? "#e8f4ff" : "#7ab3cc",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {step.label}
              </span>
              {active ? (
                <span
                  className="orchestration-progress-dot"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#00d4ff",
                    boxShadow: "0 0 10px rgba(0,212,255,0.6)",
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
