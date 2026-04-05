"use client";
import React, { useRef, useState, useCallback } from "react";
import { MODALITIES } from "@/lib/analyse/constants";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";

interface Props {
  activeModality: string;
  onSelect: (id: string) => void;
}

/* ── Per-modality accent colors for glow ── */
const MODALITY_COLORS: Record<string, string> = {
  auto: "0,196,176",    // teal
  xray: "100,180,255",  // ice blue
  ct: "180,140,255",    // purple (legacy)
  ct_abdomen: "180,140,255",
  ct_chest: "200,160,255",
  ct_cardiac: "255,120,160",
  ct_spine: "140,180,255",
  ct_brain: "160,200,255",
  brain_mri: "0,196,176",
  spine_mri: "0,170,160",
  mri: "0,196,176", // legacy id if present in history
  ultrasound: "100,220,200", // seafoam
  ecg: "255,100,120",   // rose
  pathology: "200,160,80",   // amber
  mammography: "255,140,200", // pink
  cytology: "140,200,255",   // sky
  oral_cancer: "255,160,100", // coral
  lab_report: "120,220,160",  // mint
  dermatology: "200,120,200", // orchid
};

export default function ModalityBar({ activeModality, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const { isMobile, isTablet, isTouch } = useMediaQuery();
  const compact = isMobile || isTablet;

  /* ── Mouse drag-to-scroll for desktop ── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    setIsDragging(true);
    setStartX(e.pageX - el.offsetLeft);
    setScrollLeft(el.scrollLeft);
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const el = scrollRef.current;
      if (!el) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      el.scrollLeft = scrollLeft - walk;
    },
    [isDragging, startX, scrollLeft]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    const el = scrollRef.current;
    if (el) {
      el.style.cursor = "grab";
      el.style.userSelect = "";
    }
  }, []);

  /* ── Scroll buttons for arrow navigation ── */
  const scroll = useCallback((dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  }, []);

  return (
    <div
      className="modality-bar no-print"
      style={{
        position: "relative",
        padding: compact ? "6px 0" : "10px 0",
        borderTop: "1px solid var(--glass-border)",
        background: "var(--modality-bar-bg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Left scroll arrow — hide on touch devices */}
      {!isTouch && (
        <button
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 36,
            zIndex: 2,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(90deg, var(--modality-scroll-fade) 50%, transparent)",
            color: "var(--text-30)",
            fontSize: 16,
            fontFamily: "var(--font-display)",
          }}
        >
          ‹
        </button>
      )}

      {/* Scrollable pill container */}
      <div
        ref={scrollRef}
        className="no-scrollbar"
        onMouseDown={!isTouch ? handleMouseDown : undefined}
        onMouseMove={!isTouch ? handleMouseMove : undefined}
        onMouseUp={!isTouch ? handleMouseUp : undefined}
        onMouseLeave={!isTouch ? handleMouseUp : undefined}
        style={{
          display: "flex",
          gap: compact ? 6 : 8,
          overflowX: "auto",
          padding: isTouch ? "0 12px" : "0 40px",
          cursor: isTouch ? "default" : "grab",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {MODALITIES.map((m) => {
          const isActive = activeModality === m.id;
          const rgb = MODALITY_COLORS[m.id] || "0,196,176";

          return (
            <button
              key={m.id}
              onClick={() => {
                if (!isDragging) onSelect(m.id);
              }}
              title={m.description}
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: compact ? 0 : 6,
                padding: compact ? "6px 12px" : "7px 14px",
                borderRadius: "var(--r-full)",
                border: `1px solid ${
                  isActive
                    ? `rgba(${rgb},0.5)`
                    : "var(--modality-pill-border-idle)"
                }`,
                background: isActive
                  ? `linear-gradient(135deg, rgba(${rgb},0.15), rgba(${rgb},0.05))`
                  : "var(--modality-pill-bg-idle)",
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontSize: compact ? 9 : 11,
                fontWeight: isActive ? 600 : 400,
                color: isActive
                  ? `rgb(${rgb})`
                  : "var(--text-55)",
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                boxShadow: isActive
                  ? `0 0 12px rgba(${rgb},0.2), 0 0 4px rgba(${rgb},0.1), inset 0 1px 0 rgba(${rgb},0.1)`
                  : "none",
                whiteSpace: "nowrap" as const,
                position: "relative" as const,
                overflow: "hidden" as const,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.borderColor = `rgba(${rgb},0.25)`;
                  (e.currentTarget as HTMLElement).style.color = `rgba(${rgb},0.85)`;
                  (e.currentTarget as HTMLElement).style.background = `rgba(${rgb},0.06)`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--modality-pill-border-idle)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-55)";
                  (e.currentTarget as HTMLElement).style.background = "var(--modality-pill-bg-idle)";
                }
              }}
            >
              {/* On desktop: "XRAY · X-Ray", on mobile: "XRAY" */}
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: compact ? 8 : 9,
                fontWeight: 700,
                letterSpacing: "0.12em",
                opacity: isActive ? 1 : 0.7,
              }}>
                {m.icon}
              </span>
              {!compact && (
                <>
                  <span style={{
                    width: 1,
                    height: 10,
                    background: isActive ? `rgba(${rgb},0.25)` : "var(--modality-pill-separator)",
                    flexShrink: 0,
                  }} />
                  <span>{m.label}</span>
                </>
              )}
              {/* Active glow dot */}
              {isActive && (
                <span style={{
                  position: "absolute",
                  bottom: -1,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: compact ? 12 : 16,
                  height: 2,
                  borderRadius: 1,
                  background: `rgb(${rgb})`,
                  boxShadow: `0 0 6px rgba(${rgb},0.5)`,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Right scroll arrow — hide on touch devices */}
      {!isTouch && (
        <button
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 36,
            zIndex: 2,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(270deg, var(--modality-scroll-fade) 50%, transparent)",
            color: "var(--text-30)",
            fontSize: 16,
            fontFamily: "var(--font-display)",
          }}
        >
          ›
        </button>
      )}
    </div>
  );
}
