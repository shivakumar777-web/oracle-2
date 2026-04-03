"use client";

import React, { useEffect, useRef, useState } from "react";

const MODES = [
  { id: "auto", label: "AUTO" },
  { id: "search", label: "MANTHANA WEB" },
  { id: "deep-research", label: "MED DEEP RESEARCH" },
];

interface TopModeBarProps {
  currentMode: string;
  onModeChange: (mode: string) => void;
  children?: React.ReactNode;
}

export default function TopModeBar({
  currentMode,
  onModeChange,
  children,
}: TopModeBarProps) {
  const modesContainerRef = useRef<HTMLDivElement | null>(null);
  const [isAutoScrollingModes, setIsAutoScrollingModes] = useState(true);
  const isDraggingModesRef = useRef(false);
  const lastPointerXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAutoScrollingModes) return;
    const el = modesContainerRef.current;
    if (!el) return;

    let frameId: number;
    const scrollSpeed = 0.35;

    const step = () => {
      const container = modesContainerRef.current;
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
  }, [isAutoScrollingModes]);

  const stopModesAutoScroll = () => {
    if (isAutoScrollingModes) {
      setIsAutoScrollingModes(false);
    }
  };

  const handleModesPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    stopModesAutoScroll();
    if (event.button !== 0) return;
    const container = modesContainerRef.current;
    if (!container) return;
    isDraggingModesRef.current = true;
    lastPointerXRef.current = event.clientX;
    container.setPointerCapture(event.pointerId);
    container.style.cursor = "grabbing";
  };

  const handleModesPointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!isDraggingModesRef.current) return;
    const container = modesContainerRef.current;
    if (!container || lastPointerXRef.current == null) return;
    const deltaX = event.clientX - lastPointerXRef.current;
    container.scrollLeft -= deltaX;
    lastPointerXRef.current = event.clientX;
  };

  const endModesDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingModesRef.current) return;
    const container = modesContainerRef.current;
    isDraggingModesRef.current = false;
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
    <div className="flex flex-col gap-2 px-4 py-3">
      {/* Mode selector */}
      <div
        ref={modesContainerRef}
        className="flex items-center gap-1 overflow-x-auto no-scrollbar cursor-grab"
        onWheel={stopModesAutoScroll}
        onPointerDown={handleModesPointerDown}
        onPointerMove={handleModesPointerMove}
        onPointerUp={endModesDrag}
        onPointerLeave={endModesDrag}
      >
        {MODES.map((mode) => {
          const isActive = currentMode === mode.id;
          const isDeep = mode.id === "deep-research";
          return (
            <button
              key={mode.id}
              onClick={() => {
                stopModesAutoScroll();
                onModeChange(mode.id);
              }}
              className={`pill text-[10px] flex-shrink-0 transition-all duration-200 ${
                isActive && isDeep
                  ? "bg-[rgba(124,58,237,0.18)] text-[#A78BFA] border border-[rgba(124,58,237,0.5)]"
                  : isActive
                  ? "pill-gold active"
                  : "bg-white/[0.03] text-cream/30 border border-white/[0.06] hover:text-cream/50"
              }`}
              aria-pressed={isActive}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* Right side: domain pills or other controls */}
      <div className="mt-1">{children}</div>
    </div>
  );
}
