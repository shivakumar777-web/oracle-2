"use client";

import React, { useEffect, useRef, useState } from "react";

/* ─── Thought sequences per mode ─────────────────────────────────────── */

const THOUGHT_SEQUENCES: Record<string, string[]> = {
  auto: [
    "Parsing clinical intent from your query…",
    "Activating Allopathy knowledge graph…",
    "Cross-referencing PubMed and clinical guidelines…",
    "Scanning for contraindications and safety signals…",
    "Evaluating evidence grade (RCT → meta-analysis)…",
    "Distilling key mechanisms of action…",
    "Checking for drug-food and herb-drug interactions…",
    "Integrating WHO and FDA guideline markers…",
    "Synthesising Western and integrative perspectives…",
    "Composing Amrita — the distilled response…",
  ],
  ayurveda: [
    "Consulting the Charaka Samhita and Sushruta Samhita…",
    "Identifying Prakriti and Vikruti patterns…",
    "Evaluating tridosha balance — Vata, Pitta, Kapha…",
    "Cross-referencing Dravyaguna for herbs and rasas…",
    "Mapping Ayurvedic formulations to modern pharmacology…",
    "Scanning for documented herb-drug interactions…",
    "Verifying classical preparation guidelines (Taila, Kwath)…",
    "Integrating Panchakarma relevance…",
    "Composing Amrita — the distilled Ayurvedic response…",
  ],
  homeopathy: [
    "Identifying vital force disturbance pattern…",
    "Scanning the Materia Medica repertories…",
    "Evaluating proving symptoms and potency selection…",
    "Cross-referencing Kent's Repertory…",
    "Checking constitutional correlates…",
    "Composing Amrita — the distilled response…",
  ],
  siddha: [
    "Consulting Thirumoolar and Agastiyar texts…",
    "Evaluating Mukkuttram — Vali, Azhal, Iyam…",
    "Scanning Siddha Materia Medica for herbo-mineral drugs…",
    "Cross-referencing classical Siddha formulations…",
    "Composing Amrita — the distilled response…",
  ],
  unani: [
    "Consulting Ibn Sina's Canon of Medicine…",
    "Evaluating Mizaj (temperament) classification…",
    "Scanning Unani pharmacopoeia — simple and compound drugs…",
    "Cross-referencing humoral theory with clinical data…",
    "Composing Amrita — the distilled response…",
  ],
  "deep-research": [
    "Initialising Med Deep Research protocol…",
    "Spanning all five medical knowledge oceans…",
    "Pulling systematic reviews and meta-analyses…",
    "Fetching latest clinical trial data (ClinicalTrials.gov)…",
    "Cross-referencing Cochrane, NICE, and WHO guidelines…",
    "Synthesising Ayurvedic and modern pharmacological data…",
    "Evaluating traditional use vs. evidence strength…",
    "Running contradiction and bias analysis…",
    "Building multi-system synthesis matrix…",
    "Distilling final evidence-ranked response…",
  ],
  m5: [
    "Activating M5 — Five Oceans Protocol…",
    "Spinning up Allopathy intelligence thread…",
    "Spinning up Ayurveda intelligence thread…",
    "Spinning up Homeopathy intelligence thread…",
    "Spinning up Siddha intelligence thread…",
    "Spinning up Unani intelligence thread…",
    "Gathering domain-specific depth answers in parallel…",
    "Resolving cross-domain agreements and contradictions…",
    "Generating unified M5 synthesis…",
    "Distilling Amrita — five-ocean nectar…",
  ],
  search: [
    "Formulating semantic medical search query…",
    "Scanning indexed medical literature…",
    "Ranking results by clinical relevance…",
    "Filtering for domain-specific sources…",
    "Composing search intelligence summary…",
  ],
};

/* ─── Micro icons for each thought (rotating set) ────────────────────── */
const THOUGHT_ICONS = ["◈", "◉", "◎", "◇", "✦", "⬡", "◐", "⬢"];

interface OracleThinkingProps {
  mode?: string;
  domain?: string;
  isActive: boolean;
}

export default function OracleThinking({
  mode = "auto",
  domain,
  isActive,
}: OracleThinkingProps) {
  const [visibleThoughts, setVisibleThoughts] = useState<
    { text: string; icon: string; id: number; completed: boolean }[]
  >([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const thoughtsEndRef = useRef<HTMLDivElement>(null);

  /* determine the right thought list */
  const getThoughts = (): string[] => {
    if (mode === "m5") return THOUGHT_SEQUENCES["m5"];
    if (mode === "deep-research") return THOUGHT_SEQUENCES["deep-research"];
    if (mode === "search") return THOUGHT_SEQUENCES["search"];
    // domain-specific thoughts
    if (domain && THOUGHT_SEQUENCES[domain]) return THOUGHT_SEQUENCES[domain];
    return THOUGHT_SEQUENCES["auto"];
  };

  const thoughts = getThoughts();

  /* Reset on new query */
  useEffect(() => {
    if (!isActive) return;
    setVisibleThoughts([]);
    setCurrentIdx(0);
    setCharCount(0);
  }, [isActive]);

  /* Typewriter effect for current thought */
  useEffect(() => {
    if (!isActive || currentIdx >= thoughts.length) return;
    const currentText = thoughts[currentIdx];

    if (charCount < currentText.length) {
      const t = setTimeout(
        () => setCharCount((c) => c + 1),
        18 + Math.random() * 14 // 18-32 ms per char — human-speed
      );
      return () => clearTimeout(t);
    }

    // Current thought fully typed — mark complete and move to next after delay
    const icon = THOUGHT_ICONS[currentIdx % THOUGHT_ICONS.length];
    setVisibleThoughts((prev) => {
      const updated = [...prev];
      const existing = updated.findIndex((t) => t.id === currentIdx);
      if (existing >= 0) {
        updated[existing] = { ...updated[existing], completed: true };
        return updated;
      }
      return updated;
    });

    const advance = setTimeout(() => {
      setCurrentIdx((i) => i + 1);
      setCharCount(0);
    }, 520);
    return () => clearTimeout(advance);
  }, [isActive, charCount, currentIdx, thoughts]);

  /* Add new thought entry when currentIdx advances */
  useEffect(() => {
    if (!isActive || currentIdx >= thoughts.length) return;
    const icon = THOUGHT_ICONS[currentIdx % THOUGHT_ICONS.length];
    setVisibleThoughts((prev) => {
      if (prev.find((t) => t.id === currentIdx)) return prev;
      return [
        ...prev,
        { text: "", icon, id: currentIdx, completed: false },
      ];
    });
  }, [currentIdx, isActive, thoughts]);

  /* Update the in-progress thought text */
  useEffect(() => {
    if (!isActive) return;
    setVisibleThoughts((prev) =>
      prev.map((t) =>
        t.id === currentIdx
          ? { ...t, text: thoughts[currentIdx]?.slice(0, charCount) ?? "" }
          : t
      )
    );
  }, [charCount, currentIdx, isActive, thoughts]);

  /* Auto-scroll to latest */
  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleThoughts]);

  if (!isActive || visibleThoughts.length === 0) return null;

  return (
    <div
      className="oracle-thinking-panel"
      style={{
        width: "100%",
        maxWidth: "480px",
        margin: "12px auto 0",
        borderRadius: "12px",
        border: "1px solid rgba(200,146,42,0.18)",
        background:
          "linear-gradient(135deg, rgba(2,6,16,0.92) 0%, rgba(10,24,58,0.88) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        overflow: "hidden",
        boxShadow:
          "0 0 0 1px rgba(200,146,42,0.06), 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(200,146,42,0.08)",
      }}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setIsExpanded((x) => !x)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "9px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          borderBottom: isExpanded
            ? "1px solid rgba(200,146,42,0.10)"
            : "none",
        }}
      >
        {/* Pulsing dot */}
        <span
          style={{
            display: "inline-block",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "var(--gold)",
            animation: "oracleThinkDot 1.4s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "Optima, Candara, 'Century Gothic', Verdana, sans-serif",
            fontSize: "10px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(200,146,42,0.75)",
            fontWeight: 500,
            flex: 1,
            textAlign: "left",
          }}
        >
          Oracle is thinking
        </span>
        {/* Expand / Collapse chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.25s ease",
            opacity: 0.4,
          }}
        >
          <path
            d="M2 4.5L6 8.5L10 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* ── Thought stream ── */}
      {isExpanded && (
        <div
          style={{
            maxHeight: "210px",
            overflowY: "auto",
            padding: "10px 14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            scrollbarWidth: "none",
          }}
        >
          {visibleThoughts.map((thought) => (
            <div
              key={thought.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                animation: thought.id > 0 ? "oracleThoughtRise 0.3s ease forwards" : undefined,
                opacity: thought.completed ? 0.42 : 1,
                transition: "opacity 0.4s ease",
              }}
            >
              {/* Icon */}
              <span
                style={{
                  color: thought.completed
                    ? "rgba(200,146,42,0.35)"
                    : "rgba(200,146,42,0.9)",
                  fontSize: "10px",
                  lineHeight: "18px",
                  flexShrink: 0,
                  fontFamily: "monospace",
                  transition: "color 0.3s",
                }}
              >
                {thought.completed ? "✓" : thought.icon}
              </span>

              {/* Thought text */}
              <span
                style={{
                  fontFamily:
                    "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
                  fontSize: "11.5px",
                  lineHeight: "1.55",
                  color: thought.completed
                    ? "rgba(245,240,232,0.28)"
                    : "rgba(245,240,232,0.78)",
                  transition: "color 0.4s",
                  letterSpacing: "0.01em",
                }}
              >
                {thought.text}
                {/* Cursor on active thought */}
                {!thought.completed && (
                  <span
                    style={{
                      display: "inline-block",
                      width: "1px",
                      height: "12px",
                      background: "var(--gold)",
                      marginLeft: "2px",
                      verticalAlign: "middle",
                      animation: "oracleThinkCursor 0.9s step-end infinite",
                    }}
                  />
                )}
              </span>
            </div>
          ))}
          <div ref={thoughtsEndRef} />
        </div>
      )}
    </div>
  );
}
