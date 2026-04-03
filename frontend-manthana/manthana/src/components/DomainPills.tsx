"use client";

import React, { useEffect, useRef, useState } from "react";

// Ayurveda — Kalash (pot of herbs)
const AyurvedaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
    <path d="M8 20h8M12 20v-4M7 16s-3-2-3-6c0-3 2-5 4-5h8c2 0 4 2 4 5 0 4-3 6-3 6H7z" />
    <path d="M9 5c0-1.5 1.5-3 3-3s3 1.5 3 3" />
    <path d="M10 9c1-1 3-1 4 0" />
  </svg>
);

// Homeopathy — Mortar & Pestle
const HomeopathyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
    <ellipse cx="12" cy="8" rx="6" ry="3" />
    <path d="M6 8c0 4 2 7 6 7s6-3 6-7" />
    <path d="M15 5l3-3" />
    <path d="M8 20h8" />
  </svg>
);

// Siddha — Pulse/Naadi waveform
const SiddhaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
    <path d="M2 12h3l2-5 3 10 2-7 2 4 2-2h6" />
  </svg>
);

const DOMAINS = [
  {
    id: "m5",
    label: "M5 — All 5",
    symbol: "5×",
    title: "M5 — Query all 5 medical systems simultaneously",
  },
  {
    id: "allopathy",
    label: "Allopathy",
    symbol: "⚕",
    title: "⚕ Rod of Asclepius — WHO & MCI Symbol",
  },
  {
    id: "ayurveda",
    label: "Ayurveda",
    symbol: "",
    title: "Ayurveda — Kalash herb pot",
  },
  {
    id: "homeopathy",
    label: "Homeopathy",
    symbol: "",
    title: "Homeopathy — Mortar & Pestle",
  },
  {
    id: "siddha",
    label: "Siddha",
    symbol: "",
    title: "Siddha — Naadi (pulse) waveform",
  },
  {
    id: "unani",
    label: "Unani",
    symbol: "☤",
    title: "☤ Caduceus — CCRUM Official Symbol",
  },
];

const symbolStyleFor = (id: string) => {
  if (id === "homeopathy") {
    return {
      fontFamily: "'Palatino Linotype', Georgia, serif",
      fontSize: "0.8em",
      fontStyle: "italic",
      fontWeight: 700,
      letterSpacing: "-0.02em",
    } as React.CSSProperties;
  }
  if (id === "siddha") {
    return {
      fontFamily: "'Palatino Linotype', Georgia, serif",
      fontSize: "1.1em",
    } as React.CSSProperties;
  }
  return {
    fontSize: "1em",
  } as React.CSSProperties;
};

interface DomainPillsProps {
  activeDomain: string;
  onSelect: (domain: string) => void;
}

const DRAG_THRESHOLD = 5;

export default function DomainPills({ activeDomain, onSelect }: DomainPillsProps) {
  const domainsContainerRef = useRef<HTMLDivElement | null>(null);
  const [isAutoScrollingDomains, setIsAutoScrollingDomains] = useState(true);
  const isDraggingDomainsRef = useRef(false);
  const lastPointerXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAutoScrollingDomains) return;
    const el = domainsContainerRef.current;
    if (!el) return;

    let frameId: number;
    const scrollSpeed = 0.35;

    const step = () => {
      const container = domainsContainerRef.current;
      if (!container) return;

      if (container.scrollWidth <= container.clientWidth) return;

      const atEnd =
        container.scrollLeft + container.clientWidth >=
        container.scrollWidth - 1;

      if (atEnd) {
        container.scrollLeft = 0;
      } else {
        container.scrollLeft += scrollSpeed;
      }

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [isAutoScrollingDomains]);

  const stopDomainsAutoScroll = () => {
    if (isAutoScrollingDomains) {
      setIsAutoScrollingDomains(false);
    }
  };

  const handleDomainsPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    stopDomainsAutoScroll();
    if (event.button !== 0) return;
    isDraggingDomainsRef.current = false;
    lastPointerXRef.current = event.clientX;
  };

  const handleDomainsPointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const container = domainsContainerRef.current;
    if (!container || lastPointerXRef.current == null) return;
    const deltaX = event.clientX - lastPointerXRef.current;
    if (!isDraggingDomainsRef.current) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD) {
        return;
      }
      isDraggingDomainsRef.current = true;
      try {
        container.setPointerCapture(event.pointerId);
      } catch {
        // ignore if capture is not available
      }
      container.style.cursor = "grabbing";
    }
    container.scrollLeft -= deltaX;
    lastPointerXRef.current = event.clientX;
  };

  const endDomainsDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingDomainsRef.current) return;
    const container = domainsContainerRef.current;
    isDraggingDomainsRef.current = false;
    lastPointerXRef.current = null;
    if (container) {
      try {
        container.releasePointerCapture(event.pointerId);
      } catch {
        // ignore if capture was not set
      }
      container.style.cursor = "";
    }
  };

  return (
    <div
      ref={domainsContainerRef}
      className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 cursor-grab"
      role="group"
      aria-label="Medical domain filters"
      onWheel={stopDomainsAutoScroll}
      onPointerDown={handleDomainsPointerDown}
      onPointerMove={handleDomainsPointerMove}
      onPointerUp={endDomainsDrag}
      onPointerLeave={endDomainsDrag}
    >
      {DOMAINS.map((domain) => {
        const isActive = activeDomain === domain.id;
        return (
          <button
            key={domain.id}
            onPointerUp={(event) => {
              if (!isDraggingDomainsRef.current) {
                stopDomainsAutoScroll();
                onSelect(domain.id);
              }
              event.stopPropagation();
            }}
            onClick={() => {
              stopDomainsAutoScroll();
              onSelect(domain.id);
            }}
            className="pill flex-shrink-0 transition-all duration-200"
            style={{
              border: isActive
                ? domain.id === "m5"
                  ? "1px solid var(--gold)"
                  : "1px solid var(--teal-m)"
                : "1px solid rgba(245,240,232,.12)",
              background: isActive
                ? domain.id === "m5"
                  ? "rgba(200,146,42,.12)"
                  : "rgba(0,196,176,.08)"
                : "transparent",
              color: isActive
                ? domain.id === "m5"
                  ? "var(--gold-h)"
                  : "var(--teal-h)"
                : "var(--wd)",
              boxShadow: isActive
                ? domain.id === "m5"
                  ? "0 0 12px rgba(200,146,42,.25)"
                  : "0 0 12px rgba(0,196,176,.2)"
                : "none",
              transition: "all 0.2s ease",
            }}
            aria-pressed={isActive}
            title={domain.title}
          >
            <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}>
              {domain.id === "ayurveda" && <AyurvedaIcon />}
              {domain.id === "homeopathy" && <HomeopathyIcon />}
              {domain.id === "siddha" && <SiddhaIcon />}
              {domain.id === "allopathy" && (
                <span style={symbolStyleFor(domain.id)}>{domain.symbol}</span>
              )}
              {domain.id === "unani" && (
                <span style={symbolStyleFor(domain.id)}>{domain.symbol}</span>
              )}
              {domain.id === "m5" && (
                <span style={symbolStyleFor(domain.id)}>{domain.symbol}</span>
              )}
            </span>
            <span>{domain.label}</span>
          </button>
        );
      })}
    </div>
  );
}
