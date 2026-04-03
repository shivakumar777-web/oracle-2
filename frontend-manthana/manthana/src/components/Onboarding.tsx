"use client";

import React, { useState, useEffect } from "react";
import Logo from "./Logo";

const STEPS = [
  {
    key: "welcome",
    icon: null,
    heading: "Welcome to MANTHANA",
    body: "The oracle that churns five oceans of medicine simultaneously — Ayurveda, Allopathy, Homeopathy, Siddha, and Unani — extracting only Amrita.",
    cta: "Begin",
  },
  {
    key: "ask",
    icon: "✦",
    heading: "Ask Anything Medical",
    body: "Type a question, describe symptoms, or ask about drug interactions. Manthana cross-references across all five medical traditions in real-time.",
    cta: "Next →",
  },
  {
    key: "modes",
    icon: "◎",
    heading: "Manthana Analyse",
    body: "Dedicated imaging workflows are not enabled in this build. Use Oracle, Manthana Web, and Med Deep Research for questions, search, and structured research.",
    cta: "Next →",
  },
  {
    key: "search",
    icon: "⌕",
    heading: "Manthana Web Search",
    body: "Manthana searches PubMed, WHO guidelines, Ayurvedic Pharmacopoeia, and clinical databases simultaneously, synthesising results with AI.",
    cta: "Enter the Oracle →",
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md">
      {/* Skip button — always visible */}
      <button
        onClick={onComplete}
        className="absolute top-5 right-5 font-ui text-[10px] tracking-[0.3em] uppercase text-cream/25
          hover:text-cream/60 transition-colors"
        aria-label="Skip onboarding"
      >
        SKIP ›
      </button>

      <div className="max-w-md w-full mx-6 text-center animate-rise">
        {/* Logo (first step only) */}
        {step === 0 && (
          <div className="flex justify-center mb-8">
            <Logo size="inline" animate={true} />
          </div>
        )}

        {/* Icon (other steps) */}
        {step > 0 && current.icon && (
          <div className="text-4xl text-gold-h mb-8 animate-float">{current.icon}</div>
        )}

        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-0.5 rounded-full transition-all duration-500
              ${i === step ? "w-8 bg-gold" : "w-3 bg-white/10"}`} />
          ))}
        </div>

        {/* Heading */}
        <h2 className="text-shimmer font-ui text-xl md:text-2xl tracking-[0.15em] uppercase mb-4">
          {current.heading}
        </h2>

        {/* Body */}
        <p className="font-body text-sm italic text-cream/40 leading-[1.9] mb-10 max-w-xs mx-auto">
          {current.body}
        </p>

        {/* CTA */}
        <button
          onClick={() => isLast ? onComplete() : setStep(step + 1)}
          className="btn-gold px-10 py-3 text-sm"
        >
          {current.cta}
        </button>
      </div>
    </div>
  );
}
