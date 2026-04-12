"use client";

import React, { useState } from "react";
import { useMobilePwaInstallNudge } from "@/hooks/useMobilePwaInstallNudge";
import { MAX_PWA_NUDGES, readNudgeCount } from "@/lib/pwa-install-nudge";

/**
 * Full-screen nudge on auth pages (mobile browser only): install PWA for layout parity with standalone.
 */
export default function MobilePwaInstallBanner() {
  const {
    open,
    isIos,
    canNativeInstall,
    closeNotNow,
    closeForever,
    tryNativeInstall,
  } = useMobilePwaInstallNudge();
  const [installBusy, setInstallBusy] = useState(false);

  if (!open) return null;

  const onInstall = async () => {
    if (canNativeInstall && !isIos) {
      setInstallBusy(true);
      try {
        await tryNativeInstall();
      } finally {
        setInstallBusy(false);
      }
      return;
    }
    closeNotNow();
  };

  /** Visits with nudge left including this one (count increments on “Not now”). */
  const visitsLeft = Math.max(0, MAX_PWA_NUDGES - readNudgeCount());

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-nudge-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-gold/25 bg-[#050b14]/98 shadow-[0_0_60px_rgba(0,0,0,0.5)] p-5 sm:p-6">
        <h2
          id="pwa-nudge-title"
          className="font-ui text-sm tracking-[0.2em] uppercase text-gold-h mb-2"
        >
          Install for best mobile experience
        </h2>
        <p className="text-cream/65 text-sm leading-relaxed mb-4">
          The installed MANTHANA app fits your screen like a native app (full height, safe areas). In the
          browser tab, layout can feel cramped — installing is free and takes a few seconds.
        </p>
        {isIos ? (
          <p className="text-cream/55 text-xs leading-relaxed mb-4 rounded-lg border border-white/[0.08] bg-black/30 p-3">
            <span className="text-gold-h/90 font-ui tracking-wide uppercase text-[10px]">iPhone / iPad</span>
            <br />
            Tap <strong className="text-cream/80">Share</strong>{" "}
            <span aria-hidden>(□↑)</span> → <strong className="text-cream/80">Add to Home Screen</strong> →{" "}
            <strong className="text-cream/80">Add</strong>. Then open MANTHANA from your home screen.
          </p>
        ) : !canNativeInstall ? (
          <p className="text-cream/55 text-xs leading-relaxed mb-4 rounded-lg border border-white/[0.08] bg-black/30 p-3">
            Tap your browser <strong className="text-cream/80">menu</strong> (⋮) →{" "}
            <strong className="text-cream/80">Install app</strong> or{" "}
            <strong className="text-cream/80">Add to Home screen</strong>.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onInstall}
            disabled={installBusy}
            className="w-full py-3 rounded-lg font-ui text-xs tracking-[0.15em] uppercase bg-teal-m/25 border border-teal-m/50 text-teal-h hover:bg-teal-m/35 disabled:opacity-60 transition-colors"
          >
            {installBusy
              ? "Opening install…"
              : canNativeInstall && !isIos
                ? "Install MANTHANA app"
                : isIos
                  ? "Got it — continue in browser"
                  : "Continue in browser"}
          </button>
          <button
            type="button"
            onClick={closeNotNow}
            className="w-full py-2.5 rounded-lg font-ui text-[10px] tracking-[0.2em] uppercase text-cream/45 border border-white/[0.1] hover:bg-white/[0.04] transition-colors"
          >
            Not now
            {visitsLeft > 0 ? (
              <span className="block normal-case tracking-normal text-[9px] text-cream/30 mt-1">
                ({visitsLeft} prompt{visitsLeft === 1 ? "" : "s"} left)
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={closeForever}
            className="text-center font-ui text-[9px] tracking-[0.18em] uppercase text-cream/25 hover:text-cream/45 pt-1"
          >
            Don&apos;t ask again
          </button>
        </div>
      </div>
    </div>
  );
}
