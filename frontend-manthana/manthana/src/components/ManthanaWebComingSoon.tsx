"use client";

import React from "react";
import Link from "next/link";

/**
 * Full-view “Manthana Web is paused” experience — premium, calm, on-brand.
 *
 * PM / design: headline and body copy may need final approval; do not add launch dates here.
 */
export default function ManthanaWebComingSoon({
  variant = "full",
  showBack = true,
}: {
  variant?: "full" | "compact";
  /** Show a secondary control to go back in history */
  showBack?: boolean;
}) {
  const isFull = variant === "full";

  return (
    <section
      className={`relative flex flex-col items-center justify-center text-center px-6 ${
        isFull ? "min-h-[calc(100dvh-10rem)] py-12 md:py-20" : "py-10"
      }`}
      role="region"
      aria-labelledby="manthana-web-coming-soon-title"
      aria-live="polite"
    >
      {/* Soft animated wash — GPU-friendly opacity pulse */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
        aria-hidden
      >
        <div
          className="absolute -top-1/2 left-1/2 h-[120%] w-[140%] -translate-x-1/2 rounded-full opacity-40 blur-3xl animate-[pulse_14s_ease-in-out_infinite]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(200,146,42,0.14) 0%, rgba(61,219,200,0.08) 35%, transparent 65%)",
          }}
        />
        <div
          className="absolute bottom-0 right-0 h-64 w-64 rounded-full opacity-25 blur-2xl animate-[pulse_18s_ease-in-out_infinite]"
          style={{
            background:
              "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      <div
        className={`relative z-10 max-w-lg mx-auto space-y-6 ${
          isFull ? "" : "max-w-md"
        }`}
      >
        <p className="font-ui text-[10px] tracking-[0.45em] uppercase text-gold/45">
          Manthana Web
        </p>
        <h1
          id="manthana-web-coming-soon-title"
          className="font-ui text-xl sm:text-2xl md:text-3xl font-semibold tracking-wide text-cream/90 leading-snug"
        >
          A sharper ocean is forming.
        </h1>
        <div className="space-y-3 font-body text-sm sm:text-base text-cream/55 leading-relaxed">
          <p>
            Manthana Web is under refinement—multi-source medical search, tuned for trust and
            clarity, is on its way.
          </p>
          <p>
            Something worth the wait: a calmer, sharper way to search the medical web—with
            Manthana&apos;s judgment layered on top.
          </p>
          <p className="text-cream/45 italic text-sm">
            For now, ask the Oracle—it churns the same waters, conversationally.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center min-h-[44px] px-8 py-3 rounded-full
              bg-gold/85 hover:bg-gold text-cosmic-1 font-ui text-[11px] tracking-[0.2em] uppercase
              transition-all duration-300 shadow-lg shadow-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#020610]"
          >
            Use Manthana Oracle
          </Link>
          {showBack && (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = "/";
                }
              }}
              className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-full
                border border-white/[0.12] text-cream/50 hover:text-cream/75 hover:border-gold/25
                font-ui text-[10px] tracking-[0.18em] uppercase transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-m/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020610]"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
