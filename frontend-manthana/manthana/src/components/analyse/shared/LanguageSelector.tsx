"use client";
import React, { useState, useEffect, useRef } from "react";

export interface LanguageOption {
  code: string;
  label: string;   // short native label shown in pill
  name: string;    // full native name for tooltip
  script: string;
}

export const REPORT_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "EN",     name: "English",    script: "Latin" },
  { code: "hi", label: "हिं",     name: "हिंदी",       script: "Devanagari" },
  { code: "ta", label: "தமி",    name: "தமிழ்",       script: "Tamil" },
  { code: "te", label: "తెలు",   name: "తెలుగు",     script: "Telugu" },
  { code: "kn", label: "ಕನ್ನ",   name: "ಕನ್ನಡ",      script: "Kannada" },
  { code: "ml", label: "മലയ",   name: "മലയാളം",    script: "Malayalam" },
  { code: "mr", label: "मरा",    name: "मराठी",       script: "Devanagari" },
  { code: "bn", label: "বাং",    name: "বাংলা",       script: "Bengali" },
  { code: "gu", label: "ગુ",     name: "ગુજરાતી",    script: "Gujarati" },
  { code: "pa", label: "ਪੰ",     name: "ਪੰਜਾਬੀ",     script: "Gurmukhi" },
];

const STORAGE_KEY = "manthana_report_lang";

interface Props {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function LanguageSelector({ value, onChange, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Persist language preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, value);
    }
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeLang = REPORT_LANGUAGES.find((l) => l.code === value) ?? REPORT_LANGUAGES[0];

  return (
    <div ref={ref} className={`lang-selector ${className ?? ""}`} style={{ position: "relative" }}>
      {/* Trigger pill */}
      <button
        className={`lang-selector-trigger ${disabled ? "lang-selector-disabled" : ""}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        title={`Report language: ${activeLang.name}`}
        aria-label="Select report language"
        aria-expanded={open}
      >
        <span className="lang-selector-globe">🌐</span>
        <span className="lang-selector-label">{activeLang.label}</span>
        <span className="lang-selector-name">{activeLang.name}</span>
        <span className="lang-selector-chevron" style={{ transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {/* Dropdown grid */}
      {open && (
        <div className="lang-selector-dropdown" role="listbox">
          <div className="lang-selector-hint">Select report language</div>
          <div className="lang-selector-grid">
            {REPORT_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                role="option"
                aria-selected={lang.code === value}
                className={`lang-selector-option ${lang.code === value ? "active" : ""}`}
                onClick={() => { onChange(lang.code); setOpen(false); }}
                title={`${lang.name} (${lang.script})`}
              >
                <span className="lang-option-label">{lang.label}</span>
                <span className="lang-option-name">{lang.name}</span>
                <span className="lang-option-script">{lang.script}</span>
              </button>
            ))}
          </div>
          <div className="lang-selector-footer">
            <span>🇮🇳 10 Indian languages supported</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Load persisted language preference from localStorage */
export function getPersistedLanguage(): string {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(STORAGE_KEY) ?? "en";
}
