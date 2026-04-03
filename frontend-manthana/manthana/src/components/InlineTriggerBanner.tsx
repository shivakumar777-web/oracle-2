"use client";

import React from "react";

interface InlineTriggerBannerProps {
  icon: string;
  message: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

export default function InlineTriggerBanner({
  icon,
  message,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: InlineTriggerBannerProps) {
  return (
    <div className="mt-3 mb-1 px-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <p className="font-ui text-[11px] text-amber-100/90 tracking-[0.12em] uppercase">
            {message}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrimary}
            className="px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/70 font-ui text-[10px] tracking-[0.16em] uppercase text-amber-50 hover:bg-amber-400/35 transition-colors"
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={onSecondary}
            className="px-2.5 py-1 rounded-full border border-amber-200/50 font-ui text-[10px] tracking-[0.16em] uppercase text-amber-100/80 hover:bg-amber-100/5 transition-colors"
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

