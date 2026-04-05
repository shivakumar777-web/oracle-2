"use client";
import React, { useRef, useEffect, useState, useMemo } from "react";
import { useTheme, THEMES, type Theme } from "./ThemeProvider";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";

interface Props {
  compact?: boolean;
  className?: string;
}

export default function ThemeSwitcher({ compact = false, className }: Props) {
  const { theme, setTheme } = useTheme();
  const { isDesktop } = useMediaQuery();
  const visibleThemes = useMemo(
    () => (isDesktop ? THEMES : THEMES.filter((t) => t.id !== "clinical")),
    [isDesktop]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<Theme, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  // Calculate sliding indicator position
  useEffect(() => {
    const activeBtn = btnRefs.current.get(theme);
    const container = containerRef.current;
    if (!activeBtn || !container) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    setIndicatorStyle({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
    });
  }, [theme, visibleThemes]);

  // Keyboard navigation (only among visible themes)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const idx = visibleThemes.findIndex((t) => t.id === theme);
    if (idx < 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setTheme(visibleThemes[(idx + 1) % visibleThemes.length].id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setTheme(visibleThemes[(idx - 1 + visibleThemes.length) % visibleThemes.length].id);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`theme-switcher ${className ?? ""}`}
      role="radiogroup"
      aria-label="Theme selection"
      onKeyDown={handleKeyDown}
    >
      {/* Sliding indicator */}
      <div
        className="theme-switcher-indicator"
        data-active={theme}
        style={indicatorStyle}
      />

      {/* Theme buttons — Clinical only on desktop (>1024px) */}
      {visibleThemes.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            if (el) btnRefs.current.set(t.id, el);
            else btnRefs.current.delete(t.id);
          }}
          className={`theme-switcher-btn ${theme === t.id ? "active" : ""}`}
          onClick={() => setTheme(t.id)}
          role="radio"
          aria-checked={theme === t.id}
          aria-label={`${t.label} theme: ${t.description}`}
          title={`${t.label} — ${t.description}`}
        >
          <span className="theme-icon">{t.icon}</span>
          {!compact && <span className="theme-label">{t.label}</span>}
        </button>
      ))}
    </div>
  );
}
