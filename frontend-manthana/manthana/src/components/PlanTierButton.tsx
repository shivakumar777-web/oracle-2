"use client";

import React from "react";
import type { ProductAccessValue } from "./ProductAccessProvider";

export type PlanTierButtonVariant =
  | "sidebar-expanded"
  | "sidebar-collapsed";

function planDisplay(access: ProductAccessValue): {
  title: string;
  subtitle?: string;
} {
  if (access.loading) {
    return { title: "Plan", subtitle: "Loading…" };
  }

  if (access.labsAccess) {
    const p = access.plan.toLowerCase();
    const trialLeft = access.labsTrialRemaining;
    if (
      trialLeft !== null &&
      trialLeft > 0 &&
      p !== "pro" &&
      p !== "proplus"
    ) {
      return {
        title: "Free",
        subtitle:
          trialLeft === 1
            ? "1 free Labs scan left"
            : `${trialLeft} free Labs scans left`,
      };
    }
    if (p === "proplus") return { title: "Pro Plus" };
    return { title: "PRO" };
  }

  const p = access.plan.toLowerCase();
  const active = access.status === "active";

  if (active && p === "basic") {
    return { title: "Basic", subtitle: "Upgrade to PRO for Labs" };
  }

  if ((p === "pro" || p === "proplus") && !access.labsAccess) {
    return {
      title: p === "proplus" ? "Pro Plus" : "PRO",
      subtitle: "Renew to access Labs",
    };
  }

  if (access.signedIn && access.labsTrialRemaining === 0) {
    return {
      title: "Free",
      subtitle: "Labs trial used — upgrade to PRO",
    };
  }

  return {
    title: "Free",
    subtitle:
      "Sign in: 3 lifetime Labs scans • Oracle basic AI (lower daily limits); upgrade for Pro / Pro Plus",
  };
}

/** Abbreviated tier label (sidebar collapsed + mobile bottom tab) */
function collapsedAbbrev(title: string): string {
  const t = title.toUpperCase();
  if (t === "PRO PLUS") return "P+";
  if (t === "PREMIUM") return "MAX";
  if (t === "PRO") return "PRO";
  if (t === "BASIC") return "BAS";
  if (t === "PLAN") return "…";
  return "FREE";
}

/** Single small tab in mobile BottomNav row — same visual weight as Oracle / Labs / etc. */
export function BottomNavPlanTab({
  access,
  onOpenPlans,
}: {
  access: ProductAccessValue;
  onOpenPlans: () => void;
}) {
  const { title, subtitle } = planDisplay(access);
  const abbrev = collapsedAbbrev(title);
  const tip = subtitle ? `${title} — ${subtitle}` : title;
  const icon =
    title === "Pro Plus" || title === "Premium" ? "💎" : title === "PRO" ? "⭐" : "◆";

  const subscriptionLabsActive =
    access.labsAccess && access.labsTrialRemaining === null;
  const freeOrBasicUpgrade =
    !subscriptionLabsActive && (title === "Free" || title === "Basic");
  const renewTier =
    !subscriptionLabsActive &&
    (title === "PRO" || title === "Premium" || title === "Pro Plus");

  const shellClass = subscriptionLabsActive
    ? "border-white/[0.06] bg-white/[0.02]"
    : freeOrBasicUpgrade
      ? "border-gold/35 bg-gradient-to-b from-[#C8922A]/15 to-[#0a1220]/90 shadow-[0_0_12px_rgba(200,146,42,0.12)]"
      : renewTier
        ? "border-amber-500/25 bg-amber-500/[0.06]"
        : "border-white/[0.05] bg-black/20";

  const mainTone = subscriptionLabsActive
    ? title === "Premium" || title === "Pro Plus"
      ? "text-[#C4B5FD]/90"
      : "text-gold-h/90"
    : freeOrBasicUpgrade
      ? "text-gold-h"
      : renewTier
        ? "text-amber-200/90"
        : "text-cream/40";

  const promoLine = freeOrBasicUpgrade
    ? "upgrade to pro"
    : renewTier
      ? "renew labs"
      : null;

  return (
    <button
      type="button"
      onClick={onOpenPlans}
      title={tip}
      aria-label={`Plan: ${tip}. Open subscription and plans.`}
      className="outline-none flex-1 min-w-0 flex justify-center"
    >
      <div
        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-lg border transition-colors w-full max-w-[4.75rem] ${shellClass}`}
      >
        <span className={`text-lg leading-none ${mainTone}`}>{icon}</span>
        <span
          className={`font-ui text-[8px] tracking-[0.06em] uppercase text-center leading-tight ${mainTone}`}
        >
          {abbrev}
        </span>
        {promoLine ? (
          <span className="font-ui text-[6.5px] tracking-[0.04em] lowercase text-teal-m/85 text-center leading-none px-0.5">
            {promoLine}
          </span>
        ) : null}
      </div>
    </button>
  );
}

interface PlanTierButtonProps {
  access: ProductAccessValue;
  variant: PlanTierButtonVariant;
  onOpenPlans: () => void;
}

const UPGRADE_PROMO =
  "Upgrade to Pro for premium medically trained AI models and increased Labs quota.";

export default function PlanTierButton({
  access,
  variant,
  onOpenPlans,
}: PlanTierButtonProps) {
  const { title, subtitle } = planDisplay(access);

  const isPaidActive =
    access.labsAccess && access.labsTrialRemaining === null;
  const showUpgradePromo =
    !isPaidActive && (title === "Free" || title === "Basic");

  const planHeaderIcon =
    title === "PRO" ? "⭐" : title === "Premium" || title === "Pro Plus" ? "💎" : "💎";

  const accentClass = isPaidActive
    ? title === "Premium" || title === "Pro Plus"
      ? "border-[#7C3AED]/50 hover:border-[#A78BFA]/55 shadow-[0_0_14px_rgba(124,58,237,0.12)]"
      : "border-[#C8922A]/40 hover:border-[#7DD3FC]/40 shadow-[0_0_18px_rgba(43,108,176,0.14)]"
    : "border-[#C8922A]/35 hover:border-[#C8922A]/55";

  if (variant === "sidebar-collapsed") {
    const abbr = collapsedAbbrev(title);
    return (
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onOpenPlans}
          title={`${title}${subtitle ? ` — ${subtitle}` : ""}. ${UPGRADE_PROMO}`}
          aria-label={`${title}. ${subtitle ?? "Open subscription in Settings"}. ${showUpgradePromo ? UPGRADE_PROMO : ""}`}
          className={`w-full flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] rounded-xl border bg-gradient-to-br from-[#C8922A]/[0.12] via-[#0a1220] to-[#2563eb]/[0.12] transition-all text-[9px] font-ui font-semibold tracking-[0.12em] uppercase text-cream/85 ${accentClass}`}
        >
          <span className="text-sm leading-none" aria-hidden>
            {planHeaderIcon}
          </span>
          <span>{abbr}</span>
        </button>
      </div>
    );
  }

  if (variant === "sidebar-expanded") {
    return (
      <div className="px-2 sm:px-3 pb-2 sm:pb-3">
        <button
          type="button"
          onClick={onOpenPlans}
          className={`w-full text-left rounded-xl border bg-gradient-to-br from-[#C8922A]/[0.14] via-[#0a1220] to-[#2563eb]/[0.16] transition-all hover:border-[#7DD3FC]/35 active:scale-[0.99] ${accentClass} px-2.5 py-2.5 sm:px-3 sm:py-3 min-h-[44px]`}
          aria-label={`Your plan: ${title}. ${subtitle ?? ""} Open Subscription in Settings.`}
        >
          <div className="font-ui text-[9px] sm:text-[10px] tracking-[0.18em] sm:tracking-[0.2em] uppercase text-cream/55">
            Your plan
          </div>
          <div className="mt-1 flex items-start gap-2 min-w-0">
            <span
              className={`text-base sm:text-lg leading-none shrink-0 mt-0.5 ${
                title === "Premium" || title === "Pro Plus"
                  ? "text-[#C4B5FD]"
                  : "text-gold-h/90"
              }`}
              aria-hidden
            >
              {planHeaderIcon}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={`font-ui text-sm sm:text-[15px] font-semibold tracking-wide ${
                  title === "Premium" || title === "Pro Plus"
                    ? "text-[#C4B5FD]"
                    : "text-gold-h"
                }`}
              >
                {title}
              </div>
              {subtitle ? (
                <p className="font-body text-[10px] sm:text-[11px] text-cream/45 leading-snug mt-1">
                  {subtitle}
                </p>
              ) : null}
              {showUpgradePromo ? (
                <p className="font-body text-[9px] sm:text-[10px] text-cream/38 leading-relaxed mt-2 pt-2 border-t border-white/[0.06]">
                  {UPGRADE_PROMO}
                </p>
              ) : null}
            </div>
          </div>
        </button>
      </div>
    );
  }

  return null;
}
