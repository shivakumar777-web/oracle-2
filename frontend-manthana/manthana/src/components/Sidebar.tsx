"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "./Logo";
import ServiceHealth from "./ServiceHealth";
import { useLang } from "./LangProvider";
import { authClient } from "@/lib/auth-client";
import { isFullManthanaNav } from "@/lib/product-nav";
import { useProductAccess } from "./ProductAccessProvider";
import PlanTierButton from "./PlanTierButton";
import { useToast } from "@/hooks/useToast";

type NavItem = {
  href: string;
  icon: string;
  label: string;
  id: string;
  placeholder?: boolean;
};

const ALL_NAV_ITEMS: readonly NavItem[] = [
  { href: "/", icon: "✦", label: "Oracle", id: "oracle" },
  {
    href: "/deep-research",
    icon: "🔬",
    label: "Med Deep Research",
    id: "deep-research",
  },
  { href: "/analyse", icon: "◎", label: "Labs", id: "manthana-analyse" },
  { href: "/medtrace", icon: "⬡", label: "Medtrace", id: "medtrace" },
  { href: "#history", icon: "◷", label: "History", id: "history" },
  { href: "#settings", icon: "⚙", label: "Settings", id: "settings" },
];

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
  onOverlayOpen: (overlay: string) => void;
  onOpenSubscriptionSettings: () => void;
}

export default function Sidebar({
  expanded,
  onToggle,
  onOverlayOpen,
  onOpenSubscriptionSettings,
}: SidebarProps) {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const { data: session, isPending } = authClient.useSession();
  const access = useProductAccess();
  const { addToast } = useToast();

  const navItems = isFullManthanaNav()
    ? ALL_NAV_ITEMS
    : ALL_NAV_ITEMS.filter(
        (i) => i.id !== "deep-research" && i.id !== "medtrace",
      );

  const handleClick = (item: NavItem) => {
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
        {navItems.map((item) => {
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

          const labsLocked =
            item.id === "manthana-analyse" &&
            !access.loading && !access.labsAccess;

          const body = isPlaceholder ? (
            <div title="Labs">{content}</div>
          ) : isOverlay ? (
            <div>{content}</div>
          ) : labsLocked ? (
            access.signedIn ? (
              <button
                type="button"
                className="w-full text-left"
                onClick={() => {
                  addToast(
                    "You've used all 3 free Manthana Labs trial scans. Open Plans to upgrade to PRO for full Labs.",
                    "info",
                    7000
                  );
                  onOpenSubscriptionSettings();
                }}
                title="Labs — trial used or PRO required"
                aria-label="Labs — upgrade to PRO after free trial"
              >
                <div className="relative">
                  {content}
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] opacity-60" aria-hidden>
                    🔒
                  </span>
                </div>
              </button>
            ) : (
              <Link
                href="/sign-in?callbackUrl=/analyse"
                className="block w-full text-left"
                title="Labs — sign in for 3 free trial scans"
                aria-label="Labs — sign in for free trial"
              >
                {content}
              </Link>
            )
          ) : (
            <Link href={item.href!}>{content}</Link>
          );

          return (
            <React.Fragment key={item.id}>
              {item.id === "medtrace" && (
                <div
                  className="mx-2 mt-1 border-t border-white/[0.08] pt-2"
                  aria-hidden
                />
              )}
              {body}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Clinical tools — full product only */}
      {isFullManthanaNav() && (
        <div className="px-3 pb-3">
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => {
              if (typeof window !== "undefined") {
                (window as any).openClinicalTools?.();
              }
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-left border border-transparent hover:border-gold/15 transition-colors ${
              expanded ? "" : "justify-center"
            }`}
            aria-label="Clinical tools"
          >
            <span className="text-lg w-6 text-center text-cream/50" aria-hidden>
              ⚕
            </span>
            {expanded && (
              <span className="font-ui text-[10px] tracking-[0.16em] uppercase text-cream/40">
                Clinical Tools
              </span>
            )}
          </button>
        </div>
      )}

      <PlanTierButton
        access={access}
        variant={expanded ? "sidebar-expanded" : "sidebar-collapsed"}
        onOpenPlans={onOpenSubscriptionSettings}
      />

      {/* Auth */}
      <div className="border-t border-white/[0.04] pt-2 px-2">
        {!isPending && (
          session?.user ? (
            <div className={`flex items-center gap-2 ${expanded ? "" : "justify-center"}`}>
              <div className="flex-1 min-w-0">
                {expanded && (
                  <p className="font-ui text-[10px] text-cream/60 truncate" title={session.user.email ?? undefined}>
                    {(session.user as { name?: string }).name ?? session.user.email}
                  </p>
                )}
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() =>
                    void authClient.signOut({
                      fetchOptions: {
                        onSuccess: () => {
                          window.location.assign("/");
                        },
                      },
                    })
                  }
                  className={`font-ui text-[9px] tracking-[0.12em] uppercase text-cream/40 hover:text-gold-h transition-colors ${expanded ? "" : "w-full"}`}
                >
                  Log out
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

