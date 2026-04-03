"use client";

import React, { useEffect, useState } from "react";
import Logo from "./Logo";

const STATUS_MESSAGES = [
  "Consulting the ocean of knowledge…",
  "Cross-referencing five medical systems…",
  "Extracting Amrita from the knowledge ocean…",
  "Verifying with clinical sources…",
  "Synthesising ancient and modern wisdom…",
  "Almost there — distilling the nectar…",
];

interface ChurningStateProps {
  mode?: string;
}

export default function ChurningState({ mode }: ChurningStateProps) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setMsgIdx((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-4 py-8 px-4"
      style={{ contain: "layout" }}
    >
      {/* Spinning logo — GPU layer to avoid repaint flicker */}
      <div className="relative" style={{ willChange: "transform" }}>
        <div
          style={{ animation: "rcw 3s linear infinite", display: "inline-block" }}
        >
          <Logo size="inline" animate={false} />
        </div>
        {/* Glow ring — static, no pulse to avoid flicker */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(200,146,42,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Cycling text — no key/remount, no animate-fi; update in place */}
      <p className="font-body text-xs italic text-cream/35 text-center max-w-xs min-h-[1.5rem]">
        {mode === "deep-research"
          ? "Performing deep research across all sources..."
          : STATUS_MESSAGES[msgIdx]}
      </p>

      {/* Three dots — subtle, no animation to avoid flicker */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gold-d opacity-60"
          />
        ))}
      </div>
    </div>
  );
}
