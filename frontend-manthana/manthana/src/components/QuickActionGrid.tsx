"use client";

import React from "react";

const ACTIONS = [
  {
    icon: "⌕",
    title: "Medical Web Search",
    desc: "Search guidelines, trials, and evidence across Manthana Web",
    color: "teal",
  },
  {
    icon: "💊",
    title: "Check Drug Interaction",
    desc: "Verify contraindications across modern and traditional medicine",
    color: "gold",
  },
  {
    icon: "🧪",
    title: "Find Clinical Trial",
    desc: "Search ongoing trials from ClinicalTrials.gov and CTRI India",
    color: "purple",
  },
  {
    icon: "⚖️",
    title: "Compare Treatments",
    desc: "Compare Allopathy vs Ayurveda approaches with evidence",
    color: "teal",
  },
  {
    icon: "🌿",
    title: "Ask Ayurvedic Query",
    desc: "Consult Ayurvedic knowledge with clinical cross-references",
    color: "gold",
  },
  {
    icon: "📋",
    title: "Summarize Clinical Trial",
    desc: "Extract key findings from research papers and trials",
    color: "teal",
  },
];

interface QuickActionGridProps {
  onAction: (action: string) => void;
  /** When true, Web-oriented cards show “refining” copy but keep the same action ids */
  manthanaWebLocked?: boolean;
}

export default function QuickActionGrid({
  onAction,
  manthanaWebLocked = false,
}: QuickActionGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto px-4 stagger-rise">
      {ACTIONS.map((action) => (
        <button
          key={action.title}
          onClick={() => onAction(action.title)}
          className={`glass group text-left p-5 rounded-xl transition-all duration-300
            hover:scale-[1.02] hover:shadow-lg
            ${
              action.color === "gold"
                ? "hover:border-gold/30 hover:shadow-gold/5"
                : "hover:border-teal/30 hover:shadow-teal/5"
            }`}
        >
          <div className="text-2xl mb-3">{action.icon}</div>
          <h3
            className={`font-ui text-sm font-semibold tracking-wide mb-1 transition-colors
              ${action.color === "gold" ? "text-gold-h group-hover:text-gold-p" : "text-teal-h group-hover:text-teal-p"}
            `}
          >
            {action.title}
          </h3>
          <p className="font-body text-xs text-cream/35 leading-relaxed">
            {manthanaWebLocked && action.title === "Medical Web Search"
              ? "Manthana Web is being refined—tap to see what’s next, then continue with Oracle."
              : manthanaWebLocked && action.title === "Find Clinical Trial"
                ? "Trial discovery through Web search is paused—tap for details, or ask Oracle for trial questions."
                : action.desc}
          </p>
        </button>
      ))}
    </div>
  );
}
