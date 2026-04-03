"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const TABS = [
  { href: "/", icon: "✦", label: "Oracle" },
  { href: "/search", icon: "⌕", label: "Web" },
  { href: "/deep-research", icon: "🔬", label: "Research" },
  { href: null, icon: "◎", label: "Manthana Analyse", placeholder: true as const },
  { href: "#history", icon: "◷", label: "History" },
  { href: "#settings", icon: "⚙", label: "Settings" },
] as const;

interface BottomNavProps {
  onOverlayOpen: (overlay: string) => void;
}

export default function BottomNav({ onOverlayOpen }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden
        glass border-t border-gold/10 h-14"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-full px-2">
        {TABS.map((tab) => {
          const isPlaceholder = "placeholder" in tab && tab.placeholder;
          const isOverlay = tab.href?.startsWith("#") ?? false;
          const isActive =
            isPlaceholder
              ? false
              : tab.href === "/"
              ? pathname === "/"
              : !isOverlay && tab.href && pathname.startsWith(tab.href);

          const content = (
            <div
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-lg transition-colors
                ${isPlaceholder ? "text-cream/35 opacity-70" : isActive ? "text-gold-h" : "text-cream/30"}
              `}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="font-ui text-[9px] tracking-wider uppercase">
                {tab.label}
              </span>
            </div>
          );

          if (isPlaceholder) {
            return (
              <div key={tab.label} className="pointer-events-none" aria-hidden title="Manthana Analyse">
                {content}
              </div>
            );
          }

          if (isOverlay) {
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => onOverlayOpen(tab.label.toLowerCase())}
                className="outline-none"
                aria-label={tab.label}
              >
                {content}
              </button>
            );
          }

          return (
            <Link key={tab.label} href={tab.href!} aria-label={tab.label}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
