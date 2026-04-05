"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { BREAKPOINTS } from "@/hooks/analyse/useMediaQuery";

export type Theme = "default" | "blackhole" | "clinical";

export const THEMES: { id: Theme; label: string; icon: string; description: string }[] = [
  { id: "default",   label: "Default",   icon: "◐", description: "Dark teal-gold cosmic" },
  { id: "blackhole", label: "Blackhole", icon: "●", description: "Ultra-dark AMOLED void" },
  { id: "clinical",  label: "Clinical",  icon: "☀", description: "Light healthcare blue" },
];

const STORAGE_KEY = "manthana_theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "default",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function isDesktopViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.innerWidth > BREAKPOINTS.laptop;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("default");

  /** Clinical is desktop-only; coerce to default when too narrow or on resize. */
  const resolveStoredTheme = useCallback((t: Theme): Theme => {
    if (t === "clinical" && !isDesktopViewport()) return "default";
    return t;
  }, []);

  useEffect(() => {
    function syncFromStorage() {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      let next: Theme =
        stored && ["default", "blackhole", "clinical"].includes(stored) ? stored : "default";
      next = resolveStoredTheme(next);
      if (next !== stored) {
        localStorage.setItem(STORAGE_KEY, next);
      }
      setThemeState(next);
      document.documentElement.dataset.theme = next;
    }
    syncFromStorage();
    window.addEventListener("resize", syncFromStorage);
    return () => window.removeEventListener("resize", syncFromStorage);
  }, [resolveStoredTheme]);

  const setTheme = useCallback((t: Theme) => {
    let next = t;
    if (next === "clinical" && !isDesktopViewport()) {
      next = "default";
    }
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
