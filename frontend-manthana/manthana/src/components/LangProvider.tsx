"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type LangContextValue = {
  lang: string;
  setLang: (value: string) => void;
};

const LangContext = createContext<LangContextValue | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<string>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("manthanaLang");
      if (stored) {
        setLangState(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setLang = (value: string) => {
    setLangState(value);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("manthanaLang", value);
      } catch {
        // ignore storage errors
      }
    }
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useLang must be used within a LangProvider");
  }
  return ctx;
}

