"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "./Logo";
import ServiceHealth from "./ServiceHealth";
import { useLang } from "./LangProvider";
import { authClient } from "@/lib/auth-client";
import { isManthanaWebLocked } from "@/lib/manthana-web-locked";

const NAV_ITEMS = [
  { href: "/", icon: "✦", label: "Oracle", id: "oracle" },
  { href: "/search", icon: "⌕", label: "Web", id: "search" },
  {
    href: "/deep-research",
    icon: "🔬",
    label: "Med Deep Research",
    id: "deep-research",
  },
  { href: "/analyse", icon: "◎", label: "Manthana Analyse", id: "manthana-analyse" },
  { href: "#history", icon: "◷", label: "History", id: "history" },
  { href: "#settings", icon: "⚙", label: "Settings", id: "settings" },
] as const;

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
  onOverlayOpen: (overlay: string) => void;
}

export default function Sidebar({
  expanded,
  onToggle,
  onOverlayOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const { data: session, isPending } = authClient.useSession();
  const webLocked = isManthanaWebLocked();

  const CLINICAL_TOOLS = [
    { id: "drug", icon: "💊", label: "Drug Interactions" },
    { id: "herb", icon: "🌿", label: "Herb-Drug Safety" },
    { id: "trials", icon: "🧬", label: "Clinical Trials" },
    { id: "icd10", icon: "🏥", label: "ICD-10 Lookup" },
  ] as const;

  const handleClick = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.href && item.href.startsWith("#")) {
      onOverlayOpen(item.id);
    }
  };

  return (
    <aside
      suppressHydrationWarning
      className={`fixed left-0 top-0 h-full z-40 transition-all duration-300 ease-out
        ${expanded ? "w-[280px]" : "w-[60px]"}
        glass border-r border-white/[0.06] hidden md:flex flex-col`}
    >
      {/* Logo + Toggle */}
      <div className="flex items-center h-16 px-3 gap-3">
        <button
          suppressHydrationWarning
          onClick={onToggle}
          className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/[0.04] transition-colors"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <Logo size="nav" animate={false} />
        </button>
        {expanded && (
          <span className="text-shimmer font-ui text-sm font-semibold tracking-[0.15em] uppercase animate-fi">
            MANTHANA
          </span>
        )}
      </div>

      {/* Global language selector */}
      <div className="px-3 pt-2">
        {expanded && (
          <div className="mb-3">
            <label className="block font-ui text-[9px] tracking-[0.3em] uppercase text-cream/35 mb-1">
              🗣️ AI Language
            </label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-teal-m font-ui tracking-wide cursor-pointer appearance-none"
              style={{
                backgroundColor: "rgba(10, 15, 30, 0.95)",
                border: "1px solid rgba(200, 146, 42, 0.25)",
                color: "rgba(245, 239, 232, 0.85)",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%23c8922a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
                paddingRight: "28px",
              }}
            >
              <option value="en" style={{ backgroundColor: "#0a0f1e", color: "#f5efe8" }}>English 🇮🇳</option>
              <option value="ta" style={{ backgroundColor: "#0a0f1e", color: "#f5efe8" }}>தமிழ் 🇮🇳</option>
              <option value="hi" style={{ backgroundColor: "#0a0f1e", color: "#f5efe8" }}>हिंदी 🇮🇳</option>
              <option value="te" style={{ backgroundColor: "#0a0f1e", color: "#f5efe8" }}>తెలుగు 🇮🇳</option>
              <option value="kn" style={{ backgroundColor: "#0a0f1e", color: "#f5efe8" }}>ಕನ್ನಡ 🇮🇳</option>
              <option value="ml" style={{ backgroundColor: "#0a0f1e", color: "#f5efe8" }}>മലയാളം 🇮🇳</option>
            </select>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isPlaceholder = "placeholder" in item && item.placeholder;
          const isActive =
            isPlaceholder
              ? false
              : item.href === "/"
              ? pathname === "/"
              : item.href && pathname.startsWith(item.href.replace("#", "/"));
          const isOverlay = item.href?.startsWith("#") ?? false;

          const content = (
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
                ${
                  isPlaceholder
                    ? "opacity-55 cursor-default border-l-2 border-transparent"
                    : `cursor-pointer ${
                  isActive && item.id === "deep-research"
                    ? "bg-[rgba(124,58,237,0.08)] border-l-2 border-[#7C3AED]"
                    : isActive
                    ? "bg-gold/[0.08] border-l-2 border-gold"
                    : "hover:bg-white/[0.04]"
                }`
                }
              `}
              onClick={!isPlaceholder && isOverlay ? () => handleClick(item) : undefined}
            >
              <span
                className={`text-lg w-6 text-center flex-shrink-0
                  ${
                    isPlaceholder
                      ? "text-cream/35"
                      : isActive && item.id === "deep-research"
                      ? "text-[#7C3AED]"
                      : isActive
                      ? "text-gold-h"
                      : "text-cream/40 group-hover:text-cream/70"
                  }
                `}
              >
                {item.icon}
              </span>
              {expanded && (
                <span
                  className={`font-ui text-xs tracking-[0.08em] uppercase transition-colors animate-fi
                    ${
                      isPlaceholder
                        ? "text-cream/30"
                        : isActive && item.id === "deep-research"
                        ? "text-[#A78BFA]"
                        : isActive
                        ? "text-gold-h"
                        : "text-cream/40 group-hover:text-cream/70"
                    }
                  `}
                >
                  {item.label}
                </span>
              )}
            </div>
          );

          if (isPlaceholder) {
            return (
              <div key={item.id} title="Manthana Analyse">
                {content}
              </div>
            );
          }
          return isOverlay ? (
            <div key={item.id}>{content}</div>
          ) : (
            <Link
              key={item.id}
              href={item.href!}
              title={
                item.id === "search" && webLocked
                  ? "Manthana Web — refined experience coming soon"
                  : undefined
              }
              aria-label={
                item.id === "search" && webLocked
                  ? "Manthana Web, coming soon"
                  : undefined
              }
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {/* Clinical tools shortcuts */}
      <div className="px-3 pb-3">
        {expanded && (
          <p className="font-ui text-[9px] tracking-[0.3em] uppercase text-cream/25 mt-1 mb-1.5">
            Clinical Tools
          </p>
        )}
        <div className="space-y-1">
          {CLINICAL_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              suppressHydrationWarning
              onClick={() => {
                if (typeof window !== "undefined") {
                  (window as any).openClinicalTools?.(tool.id);
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] text-left ${
                expanded ? "" : "justify-center"
              }`}
            >
              <span className="text-lg w-6 text-center text-cream/50">
                {tool.icon}
              </span>
              {expanded && (
                <span className="font-ui text-[10px] tracking-[0.16em] uppercase text-cream/40">
                  {tool.label}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Auth */}
      <div className="border-t border-white/[0.04] pt-2 px-2">
        {!isPending && (
          session?.user ? (
            <div className={`flex items-center gap-2 ${expanded ? "" : "justify-center"}`}>
              <div className="flex-1 min-w-0">
                {expanded && (
                  <p className="font-ui text-[10px] text-cream/60 truncate" title={session.user.email ?? undefined}>
                    {session.user.name ?? session.user.email}
                  </p>
                )}
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() =>
                    authClient.signOut({
                      fetchOptions: { onSuccess: () => window.location.reload() },
                    })
                  }
                  className={`font-ui text-[9px] tracking-[0.12em] uppercase text-cream/40 hover:text-gold-h transition-colors ${expanded ? "" : "w-full"}`}
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/sign-in"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors ${expanded ? "" : "justify-center"}`}
            >
              <span className="text-cream/50">🔐</span>
              {expanded && (
                <span className="font-ui text-[10px] tracking-[0.12em] uppercase text-cream/50">
                  Sign in
                </span>
              )}
            </Link>
          )
        )}
      </div>

      {/* Service Health Indicators */}
      <div className="border-t border-white/[0.04] pt-2">
        <ServiceHealth expanded={expanded} />
      </div>

      {/* Sanskrit footer */}
      {expanded && (
        <div className="px-4 pb-6 animate-fi">
          <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent mb-4" />
          <p className="font-body text-[10px] text-gold-s/60 italic text-center leading-relaxed">
            सर्वे भवन्तु निरामयाः
          </p>
          <p className="font-ui text-[8px] text-cream/20 text-center mt-1 tracking-wider">
            MAY ALL BE FREE FROM ILLNESS
          </p>
        </div>
      )}
    </aside>
  );
}

