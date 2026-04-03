"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLang } from "./LangProvider";
import { searchAutocomplete } from "@/lib/api";

const PLACEHOLDERS = [
  "What ancient wisdom can I find for you?",
  "Describe symptoms for Ayurvedic analysis...",
  "Ask about drug interactions...",
  "Compare evidence across medical systems…",
  "Search clinical trials and guidelines...",
];

const SEARCH_PLACEHOLDERS = [
  "Search PubMed, Cochrane, WHO, ICMR…",
  "Find clinical trials in India…",
  "Search Ayurvedic formulations…",
  "Find drug guidelines and dosage…",
  "Search medical literature…",
];

// Query Intensity Tiers
const INTENSITY_MODES = [
  { id: "auto", label: "AUTO", icon: "✦", color: "gold", desc: "System decides" },
  { id: "quick", label: "Quick Insight", icon: "⚡", color: "gold", desc: "Fast answers, 2-3 sentences" },
  { id: "clinical", label: "Clinical Review", icon: "🏥", color: "teal", desc: "Detailed with sources & citations" },
  { id: "deep", label: "Deep Research", icon: "🔬", color: "purple", desc: "Comprehensive analysis" },
];

// User Persona Modes
const PERSONA_MODES = [
  { id: "auto", label: "AUTO", icon: "✦", color: "gold", desc: "System decides" },
  { id: "patient", label: "Patient", icon: "👤", color: "teal", desc: "Simple language, reassuring" },
  { id: "clinician", label: "Clinician", icon: "🩺", color: "teal", desc: "Technical terms, ICD-10 codes" },
  { id: "researcher", label: "Researcher", icon: "📚", color: "purple", desc: "Citations, methodology" },
  { id: "student", label: "Student", icon: "🎓", color: "gold", desc: "Educational explanations" },
];

// Evidence Source Filter
const EVIDENCE_MODES = [
  { id: "auto", label: "AUTO", icon: "✦", color: "gold", desc: "System decides" },
  { id: "gold", label: "Gold Standard", icon: "🥇", color: "gold", desc: "Peer-reviewed + WHO/NIH/ICMR" },
  { id: "all", label: "All Evidence", icon: "🔍", color: "teal", desc: "Trials + traditional texts" },
  { id: "guidelines", label: "Guidelines Only", icon: "📋", color: "teal", desc: "Official protocols only" },
  { id: "trials", label: "Trials Active", icon: "🧪", color: "purple", desc: "Ongoing clinical trials" },
];

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (val: string) => void;
  onAttach?: () => void;
  mode?: string;
  domain?: string;
  // Mode selector state (lifted from parent)
  intensity?: string;
  persona?: string;
  evidence?: string;
  deepResearch?: boolean;
  onDeepResearchChange?: (val: boolean) => void;
  onIntensityChange?: (val: string) => void;
  onPersonaChange?: (val: string) => void;
  onEvidenceChange?: (val: string) => void;
  isThinking?: boolean;
  onStop?: () => void;
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onAttach,
  mode = "auto",
  domain = "medical",
  intensity = "auto",
  persona = "auto",
  evidence = "auto",
  deepResearch = false,
  onDeepResearchChange,
  onIntensityChange,
  onPersonaChange,
  onEvidenceChange,
  isThinking = false,
  onStop,
}: SearchBarProps) {
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [showModePanel, setShowModePanel] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const modePanelRef = useRef<HTMLDivElement>(null);
  const isSearchMode = mode === "search";
  const { lang } = useLang();

  // Local setters that call parent handlers
  const setIntensity = (val: string) => onIntensityChange?.(val);
  const setPersona = (val: string) => onPersonaChange?.(val);
  const setEvidence = (val: string) => onEvidenceChange?.(val);

  // Close mode panel when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modePanelRef.current && !modePanelRef.current.contains(e.target as Node)) {
        setShowModePanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const placeholderList = isSearchMode ? SEARCH_PLACEHOLDERS : PLACEHOLDERS;

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % placeholderList.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [placeholderList.length]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (!isSearchMode || q.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const list = await searchAutocomplete(q, domain, lang || "en");
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch {
        // Fail silently
      }
    },
    [isSearchMode, domain, lang]
  );

  const handleChange = (val: string) => {
    onChange(val);
    setHighlightedIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(val.trim());
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
      if (e.key === "Enter" && highlightedIdx >= 0) {
        e.preventDefault();
        const selected = suggestions[highlightedIdx];
        onChange(selected);
        setSuggestions([]);
        setShowSuggestions(false);
        onSubmit(selected);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && value.trim()) {
      e.preventDefault();
      setShowSuggestions(false);
      onSubmit(value.trim());
    }
  };

  const handleSuggestionClick = (s: string) => {
    onChange(s);
    setSuggestions([]);
    setShowSuggestions(false);
    onSubmit(s);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4" ref={containerRef}>
      <div className="input-churn relative">
        <div
          className={`relative flex items-center gap-2 px-4 py-3 rounded-[28px]
            ${isSearchMode ? "bg-[#0A1830] border border-[#C8922A]/20" : "bg-[#0D1B3E]"}`}
        >
          {/* Mode pill - clickable to open mode panel */}
          <button
            onClick={() => setShowModePanel(!showModePanel)}
            className={`pill text-[10px] flex-shrink-0 cursor-pointer transition-all ${
              isSearchMode ? "pill-search" : "pill-gold"
            } ${showModePanel ? "ring-2 ring-gold/50" : ""}`}
            aria-label="Select query mode"
            title="Click to configure query mode"
          >
            {isSearchMode ? "WEB" : intensity === "auto" && persona === "auto" && evidence === "auto" ? "AUTO" : "CUSTOM"}
          </button>

          {/* Mode Selection Panel */}
          {showModePanel && !isSearchMode && (
            <div
              ref={modePanelRef}
              className="absolute left-0 top-full mt-2 z-50 w-[320px] rounded-xl
                bg-[#0A1628] border border-white/[0.08] shadow-2xl overflow-hidden"
            >
              {/* Section 1: Query Intensity */}
              <div className="p-3 border-b border-white/[0.06]">
                <div className="text-[10px] uppercase tracking-wider text-cream/40 mb-2 font-ui">
                  Query Intensity
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {INTENSITY_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setIntensity(m.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all
                        ${intensity === m.id
                          ? m.color === "gold" ? "bg-gold/20 border border-gold/40" :
                            m.color === "teal" ? "bg-teal/20 border border-teal/40" :
                            "bg-purple/20 border border-purple/40"
                          : "hover:bg-white/[0.04] border border-transparent"
                        }`}
                    >
                      <span className="text-sm">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-medium truncate
                          ${intensity === m.id
                            ? m.color === "gold" ? "text-gold" :
                              m.color === "teal" ? "text-teal" : "text-purple"
                            : "text-cream/70"
                          }`}>
                          {m.label}
                        </div>
                        <div className="text-[9px] text-cream/40 truncate leading-tight">
                          {m.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: User Persona */}
              <div className="p-3 border-b border-white/[0.06]">
                <div className="text-[10px] uppercase tracking-wider text-cream/40 mb-2 font-ui">
                  User Persona
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {PERSONA_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPersona(m.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all
                        ${persona === m.id
                          ? m.color === "gold" ? "bg-gold/20 border border-gold/40" :
                            m.color === "teal" ? "bg-teal/20 border border-teal/40" :
                            "bg-purple/20 border border-purple/40"
                          : "hover:bg-white/[0.04] border border-transparent"
                        }`}
                    >
                      <span className="text-sm">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-medium truncate
                          ${persona === m.id
                            ? m.color === "gold" ? "text-gold" :
                              m.color === "teal" ? "text-teal" : "text-purple"
                            : "text-cream/70"
                          }`}>
                          {m.label}
                        </div>
                        <div className="text-[9px] text-cream/40 truncate leading-tight">
                          {m.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 3: Evidence Source */}
              <div className="p-3">
                <div className="text-[10px] uppercase tracking-wider text-cream/40 mb-2 font-ui">
                  Evidence Source
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {EVIDENCE_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setEvidence(m.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all
                        ${evidence === m.id
                          ? m.color === "gold" ? "bg-gold/20 border border-gold/40" :
                            m.color === "teal" ? "bg-teal/20 border border-teal/40" :
                            "bg-purple/20 border border-purple/40"
                          : "hover:bg-white/[0.04] border border-transparent"
                        }`}
                    >
                      <span className="text-sm">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-medium truncate
                          ${evidence === m.id
                            ? m.color === "gold" ? "text-gold" :
                              m.color === "teal" ? "text-teal" : "text-purple"
                            : "text-cream/70"
                          }`}>
                          {m.label}
                        </div>
                        <div className="text-[9px] text-cream/40 truncate leading-tight">
                          {m.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 4: Deep Research upgrade */}
              <div className="p-3 border-t border-white/[0.06]">
                <button
                  onClick={() => onDeepResearchChange?.(!deepResearch)}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all
                    ${deepResearch ? "bg-purple/20 border border-purple/40" : "hover:bg-white/[0.04] border border-transparent"}`}
                >
                  <span className="text-sm">🔬</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-medium ${deepResearch ? "text-purple" : "text-cream/70"}`}>
                      Deep Research
                    </div>
                    <div className="text-[9px] text-cream/40 truncate leading-tight">
                      Include ClinicalTrials.gov + PubMed
                    </div>
                  </div>
                  <span className={`text-xs ${deepResearch ? "text-purple" : "text-cream/40"}`}>
                    {deepResearch ? "ON" : "OFF"}
                  </span>
                </button>
              </div>

              {/* Section 5: M5 Five Domain Mode */}
              <div className="p-3 border-t border-white/[0.06]">
                <a
                  href="/?mode=m5"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = "/?mode=m5";
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all
                    hover:bg-gold/[0.08] border border-gold/20 hover:border-gold/40 group"
                >
                  <span className="text-lg font-mono font-bold text-gold">5×</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-gold group-hover:text-gold-h">
                      M5 — Five Domains
                    </div>
                    <div className="text-[9px] text-cream/40 truncate leading-tight">
                      Query all 5 medical systems: Allopathy, Ayurveda, Homeopathy, Siddha, Unani
                    </div>
                  </div>
                  <span className="text-xs text-gold/60 group-hover:text-gold">5×</span>
                </a>
              </div>

              {/* Footer */}
              <div className="px-3 py-2 bg-white/[0.02] border-t border-white/[0.06] flex justify-between items-center">
                <button
                  onClick={() => {
                    setIntensity("auto");
                    setPersona("auto");
                    setEvidence("auto");
                    onDeepResearchChange?.(false);
                  }}
                  className="text-[10px] text-cream/50 hover:text-gold transition-colors"
                >
                  Reset to AUTO
                </button>
                <button
                  onClick={() => setShowModePanel(false)}
                  className="px-3 py-1 rounded-md bg-gold/20 text-gold text-[11px] font-medium
                    hover:bg-gold/30 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder={placeholderList[placeholderIdx]}
            className="flex-1 bg-transparent outline-none font-body text-sm text-cream
              placeholder:text-cream/25 placeholder:italic"
            aria-label={isSearchMode ? "Search Manthana Web" : "Ask Manthana"}
            aria-autocomplete={isSearchMode ? "list" : "none"}
            aria-expanded={showSuggestions}
            role="combobox"
          />

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Attach */}
            <button
              onClick={onAttach}
              className="w-8 h-8 rounded-full flex items-center justify-center
                text-cream/30 hover:text-gold-h hover:bg-white/[0.04] transition-colors"
              aria-label="Attach file"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            {/* Mic */}
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center
                text-cream/30 hover:text-gold-h hover:bg-white/[0.04] transition-colors"
              aria-label="Voice input"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            </button>

            {/* Send / Stop */}
            <button
              onClick={() =>
                isThinking ? onStop?.() : value.trim() && onSubmit(value.trim())
              }
              disabled={!isThinking && !value.trim()}
              className="w-9 h-9 rounded-full flex items-center justify-center
                bg-gold/80 hover:bg-gold text-cosmic-1 transition-all
                disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={isThinking ? "Stop" : isSearchMode ? "Search" : "Send message"}
            >
              {isThinking ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              ) : isSearchMode ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl
              bg-[#0A1628] border border-white/[0.08] shadow-2xl overflow-hidden"
            role="listbox"
          >
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                role="option"
                aria-selected={idx === highlightedIdx}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionClick(s)}
                className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors
                  flex items-center gap-2 ${
                  idx === highlightedIdx
                    ? "bg-[#C8922A]/10 text-[#C8922A]"
                    : "text-cream/60 hover:bg-white/[0.04] hover:text-cream/80"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" opacity="0.5">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
