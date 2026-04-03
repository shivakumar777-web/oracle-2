"use client";

import React from "react";

type Props = {
  className?: string;
};

/**
 * Chrome/Google-style "new tab": opens a fresh /search in a new browser tab.
 */
export default function SearchNewTabButton({ className = "" }: Props) {
  const openFreshTab = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/search`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={openFreshTab}
      title="New tab — opens a fresh search in a new browser tab (like Google)"
      aria-label="Open new search in a new browser tab"
      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.08]
        bg-[#0D1B3E]/90 text-cream/80 shadow-sm transition-all hover:border-gold/35 hover:bg-white/[0.04]
        hover:text-gold-h active:scale-95 ${className}`}
    >
      <span className="text-lg font-light leading-none">+</span>
    </button>
  );
}
