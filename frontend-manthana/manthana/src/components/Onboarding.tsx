"use client";

import React, { useMemo, useState, useEffect } from "react";
import Logo from "./Logo";
import { isManthanaWebLocked } from "@/lib/manthana-web-locked";
import { FREE_LABS_TRIAL_TOTAL } from "@/lib/product-access";

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
    body: "Type a question, describe symptoms, or ask about drug interactions. Pick the M5 — All 5 domain or open the mode panel for five-domain answers — included on Free. Single-domain chat uses your daily Oracle allowance.",
    cta: "Next →",
  },
  {
    key: "modes",
    icon: "◎",
    heading: "Manthana Labs",
    body: `Sign in for ${FREE_LABS_TRIAL_TOTAL} free lifetime imaging scans (any modality). After that, PRO unlocks full Labs quotas. Use Oracle, Manthana Web, and Med Deep Research for questions, search, and structured research.`,
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

function onboardingSteps() {
  if (!isManthanaWebLocked()) return STEPS;
  return STEPS.filter((s) => s.key !== "search").map((s) =>
    s.key === "modes"
      ? {
          ...s,
          body: `Sign in for ${FREE_LABS_TRIAL_TOTAL} free lifetime Labs scans, then PRO for full access. Use Manthana Oracle and Med Deep Research for conversation and structured research. Manthana Web is being refined and will return soon.`,
        }
      : s,
  );
}

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const steps = useMemo(() => onboardingSteps(), []);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

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
          {steps.map((_, i) => (
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
