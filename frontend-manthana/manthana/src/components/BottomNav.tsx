"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { isFullManthanaNav } from "@/lib/product-nav";
import { useProductAccess } from "./ProductAccessProvider";
import { useToast } from "@/hooks/useToast";
import { BottomNavPlanTab } from "./PlanTierButton";

type BottomTab = {
  href: string;
  icon: string;
  label: string;
  placeholder?: boolean;
};

const ALL_TABS: readonly BottomTab[] = [
  { href: "/", icon: "✦", label: "Oracle" },
  { href: "/deep-research", icon: "🔬", label: "Research" },
  { href: "/analyse", icon: "◎", label: "Labs" },
  { href: "/medtrace", icon: "⬡", label: "Medtrace" },
  { href: "/clinical-tools", icon: "⚕", label: "Tools" },
  { href: "#history", icon: "◷", label: "History" },
  { href: "#settings", icon: "⚙", label: "Settings" },
];

const tabSlotClass =
  "flex-1 min-w-0 flex justify-center items-center outline-none";

interface BottomNavProps {
  onOverlayOpen: (overlay: string) => void;
  onOpenSubscriptionSettings?: () => void;
}

export default function BottomNav({
  onOverlayOpen,
  onOpenSubscriptionSettings,
}: BottomNavProps) {
  const pathname = usePathname();
  const access = useProductAccess();
  const { addToast } = useToast();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const tabs = isFullManthanaNav()
    ? ALL_TABS
    : ALL_TABS.filter(
        (t) =>
          t.href !== "/deep-research" &&
          t.href !== "/medtrace" &&
          t.href !== "/clinical-tools",
      );

  const renderPlanTab = () => (
    <BottomNavPlanTab
      key="nav-plan-tier"
      access={access}
      onOpenPlans={() => onOpenSubscriptionSettings?.()}
    />
  );

  const rowItems = tabs.flatMap((tab) => {
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
        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg transition-colors max-w-[4.25rem]
          ${isPlaceholder ? "text-cream/35 opacity-70" : isActive ? "text-gold-h" : "text-cream/30"}
        `}
      >
        <span className="text-lg">{tab.icon}</span>
        <span className="font-ui text-[9px] tracking-wider uppercase text-center leading-tight">
          {tab.label}
        </span>
      </div>
    );

    let slot: React.ReactNode;

    if (isPlaceholder) {
      slot = (
        <div
          className={tabSlotClass}
          key={tab.label}
          role="presentation"
          title="Labs"
        >
          {content}
        </div>
      );
    } else if (isOverlay) {
      slot = (
        <button
          key={tab.label}
          type="button"
          onClick={() => onOverlayOpen(tab.label.toLowerCase())}
          className={tabSlotClass}
          aria-label={tab.label}
        >
          {content}
        </button>
      );
    } else {
      const labsLocked =
        tab.href === "/analyse" && !access.loading && !access.labsAccess;

      if (labsLocked) {
        const lockedBody = (
          <div className="flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg transition-colors text-cream/35 max-w-[4.25rem]">
            <span className="text-lg relative">
              {tab.icon}
              {access.signedIn ? (
                <span className="absolute -right-1 -top-0.5 text-[8px]" aria-hidden>
                  🔒
                </span>
              ) : null}
            </span>
            <span className="font-ui text-[9px] tracking-wider uppercase text-center leading-tight">
              {tab.label}
            </span>
          </div>
        );
        slot = access.signedIn ? (
          <button
            key={tab.label}
            type="button"
            onClick={() => {
              addToast(
                "You've used all 3 free Manthana Labs trial scans. Open Plans to upgrade to PRO for full Labs.",
                "info",
                7000,
              );
              onOpenSubscriptionSettings?.();
            }}
            className={tabSlotClass}
            aria-label={`${tab.label} — upgrade required`}
          >
            {lockedBody}
          </button>
        ) : (
          <Link
            key={tab.label}
            href="/sign-in?callbackUrl=/analyse"
            className={tabSlotClass}
            aria-label={`${tab.label} — sign in for trial`}
          >
            {lockedBody}
          </Link>
        );
      } else {
        slot = (
          <Link
            key={tab.label}
            href={tab.href!}
            aria-label={tab.label}
            className={tabSlotClass}
          >
            {content}
          </Link>
        );
      }
    }

    const out: React.ReactNode[] = [slot];
    if (tab.href === "/analyse") {
      out.push(renderPlanTab());
    }
    return out;
  });

  const hasLabs = tabs.some((t) => t.href === "/analyse");
  if (!hasLabs) {
    rowItems.push(renderPlanTab());
  }

  return (
    <div className="bottom-nav-pwa-host fixed bottom-0 left-0 right-0 z-50 md:hidden pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]">
      {mobileNavOpen ? (
        <nav
          className="glass border-t border-gold/10 h-14"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="relative flex items-stretch h-full px-0.5">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute -top-7 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full border border-gold/45 bg-[#050b14]/92 text-gold-h text-sm leading-none flex items-center justify-center"
              aria-label="Collapse bottom bar"
            >
              ▾
            </button>
            {rowItems}
          </div>
        </nav>
      ) : (
        <div className="flex justify-center pb-1">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="w-7 h-7 rounded-full border border-gold/45 bg-[#050b14]/92 text-gold-h text-sm leading-none flex items-center justify-center"
            aria-label="Expand bottom bar"
          >
            ▴
          </button>
        </div>
      )}
    </div>
  );
}
