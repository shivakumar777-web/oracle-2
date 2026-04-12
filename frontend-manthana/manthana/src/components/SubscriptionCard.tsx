"use client";

import React, { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/useToast";
import { SCANS_LIMIT_UNLIMITED_SENTINEL } from "@/lib/razorpay/client";
import { PRO_LABS_LIMITS } from "@/lib/labs/modality-tier";

const SALES_EMAIL = "info@quaasx108.com";

type PlanCta = "none" | "razorpay" | "mailto";

interface PlanDef {
  id: string;
  name: string;
  price: number | null;
  period: string;
  features: string[];
  highlighted?: boolean;
  cta: PlanCta;
  mailtoSubject?: string;
}

const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "forever",
    cta: "none",
    features: [
      "3 lifetime Manthana Labs trial scans (signed-in)",
      "Oracle: basic medical AI models (M5) — less capable than paid tiers",
      "Lower daily Oracle rate limits (fair use)",
      "Priority processing: Light",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 399,
    period: "month",
    cta: "razorpay",
    highlighted: true,
    features: [
      `${PRO_LABS_LIMITS.totalMonthly} Labs scans/month (max ${PRO_LABS_LIMITS.dailyMax}/day, UTC)`,
      "Tier caps: 120 light (X-ray, ECG, derm, lab, oral) · 15 CT/MRI · 15 USG + mammo + pathology + cytology",
      "2D uploads only for CT/MRI/USG-style modalities (no video files)",
      "Manthana Labs + full Oracle (M5, clinical)",
      "Multi-model analysis",
      "Priority processing: Standard (medium queue)",
    ],
  },
  {
    id: "proplus",
    name: "Pro Plus",
    price: 999,
    period: "month",
    cta: "razorpay",
    features: [
      `Same Labs allowance as Pro: ${PRO_LABS_LIMITS.totalMonthly} scans/month (max ${PRO_LABS_LIMITS.dailyMax}/day, UTC)`,
      "Oracle: premium medical models — higher-quality inference; marketed without tight rate limits vs Free/Pro (fair use applies)",
      "2D DICOM, PACS & Orthanc-oriented workflows; no 3D volumetric on this tier",
      "Higher priority processing than Pro",
      "Email support with faster turnaround",
    ],
  },
  {
    id: "premium_modalities",
    name: "Premium — higher modalities",
    price: 3999,
    period: "month",
    cta: "mailto",
    mailtoSubject: "Manthana — Premium higher modalities (₹3999/mo)",
    features: [
      "150 combined Labs scans/month: CT, MRI, cytology, pathology, mammography, plus oral cancer, X-ray, and related light-tier modalities",
      "3D volumetric, full DICOM video, PACS & Orthanc",
      "Direct enterprise support",
      "Priority processing: Higher",
      "Pay after confirmation with sales — no self-serve checkout",
    ],
  },
  {
    id: "custom",
    name: "Custom",
    price: null,
    period: "tailored",
    cta: "mailto",
    mailtoSubject: "Manthana — Custom plan inquiry",
    features: [
      "Three bands: higher / medium / lower intensity — tailored to your volume and modalities",
      "Custom pricing and SLAs with sales",
      "Built for departments, chains, and integrators",
      "Priority processing: Highest (contractual)",
      "Contact sales to scope your deployment",
    ],
  },
];

function subscriptionPlanLabel(plan: string): string {
  const p = (plan || "free").toLowerCase();
  if (p === "enterprise" || p === "proplus") return "PRO PLUS";
  if (p === "basic") return "BASIC";
  return p.toUpperCase();
}

function canonicalSubscriptionPlanId(plan: string): string {
  const p = (plan || "free").toLowerCase();
  if (p === "enterprise") return "proplus";
  return p;
}

interface LabsUsagePayload {
  plan?: "pro" | "proplus";
  dailyMax?: number;
  lightCap?: number;
  ctMriCap?: number;
  mediumCap?: number;
  monthlyCap?: number;
  lightUsed: number;
  lightRemaining: number;
  ctMriUsed: number;
  ctMriRemaining: number;
  mediumUsed: number;
  mediumRemaining: number;
  totalUsed: number;
  totalRemaining: number;
  todayUsed: number;
  todayRemaining: number;
  pro2dOnly?: boolean;
}

interface LabsLifetimeTrial {
  total: number;
  used: number;
  remaining: number;
}

interface SubscriptionData {
  status: string;
  plan: string;
  subscriptionId?: string;
  expiresAt?: number;
  scansUsed: number;
  scansLimit: number;
  scansRemaining: number;
  monthlyScansBar?: boolean;
  oracleDailyCap?: number;
  labsLifetimeTrial?: LabsLifetimeTrial | null;
  labsUsage?: LabsUsagePayload | null;
}

function PriorityMatrix() {
  const rows = [
    { label: "Oracle / queue", values: ["Light", "Medium", "Higher", "Higher", "Highest"] },
    { label: "Labs throughput", values: ["Trial only", "Standard", "Standard", "Premium cap", "Custom"] },
  ];
  const heads = ["Free", "Pro", "Pro Plus", "Premium", "Custom"];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <p className="font-ui text-[9px] sm:text-[10px] tracking-[0.2em] uppercase text-cream/45 px-3 py-2 border-b border-white/[0.06]">
        Priority processing (overview)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="font-ui text-[8px] sm:text-[9px] text-cream/35 uppercase tracking-wider p-2 pl-3 w-[28%]">
                Tier
              </th>
              {heads.map((h) => (
                <th
                  key={h}
                  className="font-ui text-[8px] sm:text-[9px] text-gold-h/80 uppercase tracking-wider p-2"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-white/[0.04] last:border-0">
                <td className="font-body text-[9px] sm:text-[10px] text-cream/50 p-2 pl-3">
                  {row.label}
                </td>
                {row.values.map((v, i) => (
                  <td
                    key={i}
                    className="font-body text-[9px] sm:text-[10px] text-cream/70 p-2"
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScarcityBanner() {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="font-ui text-[9px] sm:text-[10px] tracking-[0.12em] uppercase text-amber-200/90 mb-1">
        Founding capacity
      </p>
      <p className="font-body text-[10px] sm:text-[11px] text-cream/65 leading-relaxed">
        We can onboard up to <strong className="text-cream/85">500</strong> paid seats across Pro, Pro
        Plus, Premium &amp; Custom, and <strong className="text-cream/85">500</strong> free accounts while
        we scale infrastructure. Additional capacity is in active development so every Indian doctor can
        access standard and premium radiology-style reporting at fair pricing.
      </p>
    </div>
  );
}

export default function SubscriptionCard() {
  const { data: session } = authClient.useSession();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const user = session?.user as { email?: string; name?: string; subscriptionPlan?: string; subscriptionStatus?: string; scansThisMonth?: number; scansLimit?: number };

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const res = await fetch("/api/razorpay/checkout");
        if (res.ok) {
          const data = await res.json();
          setSubscriptionData(data);
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    if (user) {
      void fetchSubscription();
    }
  }, [user]);

  const normalizeLimit = (n: number | undefined) =>
    n != null && n >= SCANS_LIMIT_UNLIMITED_SENTINEL ? Infinity : (n ?? 0);

  const currentPlan = subscriptionData?.plan || user?.subscriptionPlan || "free";
  const currentPlanCanonical = canonicalSubscriptionPlanId(currentPlan);
  const isActive = subscriptionData?.status === "active" || user?.subscriptionStatus === "active";
  const monthlyBar = subscriptionData?.monthlyScansBar === true;

  const scansUsed = subscriptionData?.scansUsed ?? user?.scansThisMonth ?? 0;
  const scansLimit = normalizeLimit(subscriptionData?.scansLimit ?? user?.scansLimit);
  const scansRemaining =
    scansLimit === Infinity ? Infinity : Math.max(0, scansLimit - scansUsed);
  const usagePercent =
    scansLimit === Infinity || scansLimit === 0
      ? 0
      : Math.min(100, (scansUsed / scansLimit) * 100);

  const openSalesMail = useCallback(
    (plan: PlanDef) => {
      const subj = plan.mailtoSubject ?? "Manthana — Sales inquiry";
      const email = user?.email ?? "";
      const body =
        plan.id === "premium_modalities"
          ? `Hello,\n\nI am interested in the Premium higher modalities plan (₹3999/month).\n\nAccount email: ${email || "(not signed in)"}\n\nPlease contact me to confirm availability and next steps.\n\nThank you.`
          : `Hello,\n\nI would like a custom Manthana plan (higher / medium / lower tier options).\n\nAccount email: ${email || "(not signed in)"}\n\nPlease contact me to discuss requirements and pricing.\n\nThank you.`;
      window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    },
    [user?.email]
  );

  const handleSubscribe = async (planId: string) => {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan || plan.cta === "none") return;

    if (plan.cta === "mailto") {
      openSalesMail(plan);
      return;
    }

    const rzpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!rzpKey) {
      addToast("Payments are not configured (missing NEXT_PUBLIC_RAZORPAY_KEY_ID).", "warning", 8000);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/razorpay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create checkout");
      }

      const { subscriptionId } = await res.json();

      if (!(window as unknown as { Razorpay?: unknown }).Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: subscriptionId,
        name: "Manthana Labs",
        description: `${plan.name} — subscription`,
        prefill: {
          email: user?.email,
          name: user?.name,
        },
        theme: {
          color: "#00c8b4",
        },
        handler: function () {
          addToast("Payment received. Activating your plan…", "success", 6000);
          window.location.reload();
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const Rzp = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
      const rzp = new Rzp(options);
      rzp.open();
    } catch (error: unknown) {
      console.error("Subscription error:", error);
      const msg =
        error instanceof Error ? error.message : "Failed to start checkout. Please try again.";
      addToast(msg, "error", 8000);
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (
      !confirm(
        "Are you sure you want to cancel your subscription? You'll keep access until the end of your billing period."
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/razorpay/cancel", {
        method: "POST",
      });

      if (res.ok) {
        addToast(
          "Subscription cancelled. Access continues until the end of the billing period.",
          "success",
          8000
        );
        window.location.reload();
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to cancel subscription");
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Failed to cancel subscription. Please try again.";
      addToast(msg, "error", 8000);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-4">
        <p className="text-cream/50 text-center">Please sign in to view subscription</p>
      </div>
    );
  }

  const trial = subscriptionData?.labsLifetimeTrial;
  const oracleCap = subscriptionData?.oracleDailyCap;

  return (
    <div className="space-y-5 sm:space-y-6">
      <ScarcityBanner />

      <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="min-w-0">
            <p className="text-xs text-cream/50 uppercase tracking-wider mb-1">Current Plan</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-ui text-[10px] tracking-[0.3em] uppercase px-3 sm:px-4 py-1.5 rounded-full border ${
                  isActive
                    ? "border-gold/30 bg-gold/[0.08] text-gold-h"
                    : "border-white/[0.12] bg-white/[0.04] text-cream/50"
                }`}
              >
                {subscriptionPlanLabel(currentPlan)}
              </span>
              {isActive && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              )}
            </div>
          </div>
          {isActive && currentPlan !== "free" && (
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={loading}
              className="text-xs text-red-400 hover:text-red-300 underline transition-colors shrink-0"
            >
              Cancel
            </button>
          )}
        </div>

        {trial != null && (!isActive || currentPlanCanonical === "free") && (
          <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] mb-3">
            <div className="flex justify-between mb-2">
              <span className="font-ui text-[10px] text-cream/35">Labs (lifetime trial)</span>
              <span className="font-ui text-[10px] text-gold/70">
                {trial.used} / {trial.total} used · {trial.remaining} left
              </span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-d to-teal-m rounded-full transition-all duration-500"
                style={{
                  width: `${trial.total ? Math.min(100, (trial.used / trial.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {oracleCap != null && (!monthlyBar || currentPlanCanonical === "free") && (
          <p className="font-body text-[10px] sm:text-[11px] text-cream/40 mb-3">
            Free Oracle tier: up to ~{oracleCap} requests per day (rolling fair use; may change).
          </p>
        )}

        {monthlyBar && scansLimit !== Infinity && scansLimit > 0 && (
          <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] mb-3">
            <div className="flex justify-between mb-2">
              <span className="font-ui text-[10px] text-cream/35">Labs scans (this month · UTC)</span>
              <span className="font-ui text-[10px] text-gold/70">
                {scansUsed} / {scansLimit}
              </span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold-d to-gold-h rounded-full shadow-sm shadow-gold/20 transition-all duration-500"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="font-ui text-[9px] text-cream/15 mt-2">
              {scansRemaining === Infinity ? "—" : `${scansRemaining} remaining this month`}
            </p>
          </div>
        )}

        {monthlyBar && scansLimit === Infinity && (
          <p className="text-xs text-emerald-400/70 mb-3">Unlimited scans (legacy profile)</p>
        )}

        {subscriptionData?.labsUsage &&
          (currentPlanCanonical === "pro" || currentPlanCanonical === "proplus") &&
          isActive && (
            <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] mt-3 text-[10px] text-cream/45 space-y-1">
              <p className="font-ui text-[9px] uppercase tracking-wider text-cream/35 mb-1">
                Labs breakdown (this month · UTC)
              </p>
              <p>
                Today: {subscriptionData.labsUsage.todayUsed}/
                {subscriptionData.labsUsage.dailyMax ?? PRO_LABS_LIMITS.dailyMax} · Total:{" "}
                {subscriptionData.labsUsage.totalUsed}/
                {subscriptionData.labsUsage.monthlyCap ?? PRO_LABS_LIMITS.totalMonthly}
              </p>
              <p>
                Light: {subscriptionData.labsUsage.lightUsed}/
                {subscriptionData.labsUsage.lightCap ?? PRO_LABS_LIMITS.lightMonthly} · CT/MRI:{" "}
                {subscriptionData.labsUsage.ctMriUsed}/
                {subscriptionData.labsUsage.ctMriCap ?? PRO_LABS_LIMITS.ctMriMonthly} · Medium:{" "}
                {subscriptionData.labsUsage.mediumUsed}/
                {subscriptionData.labsUsage.mediumCap ?? PRO_LABS_LIMITS.mediumMonthly}
              </p>
            </div>
          )}

        {subscriptionData?.expiresAt != null && (
          <p className="text-xs text-cream/40 mt-2">
            Renews: {new Date(subscriptionData.expiresAt * 1000).toLocaleDateString()}
          </p>
        )}
      </div>

      <PriorityMatrix />

      {subscriptionLoading ? (
        <div className="text-center text-cream/50 text-sm">Loading plans…</div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlanCanonical === plan.id;
            const isPlanActive = isCurrentPlan && isActive;
            const isFree = plan.id === "free";
            const onFreeTier = isFree && isCurrentPlan;
            const needsReactivate =
              isCurrentPlan && !isActive && !isFree && plan.price != null && plan.price > 0;

            const isSales = plan.cta === "mailto";
            const ctaLabel = isPlanActive
              ? "Current Plan"
              : onFreeTier
                ? "Your plan"
                : needsReactivate
                  ? "Reactivate"
                : isSales
                  ? "Contact sales"
                  : loading
                    ? "Processing…"
                    : isFree
                      ? "Free"
                      : "Subscribe";

            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-3 sm:p-4 relative transition-all ${
                  plan.highlighted
                    ? "border-gold/40 bg-gold/[0.05]"
                    : "border-white/[0.08] bg-white/[0.02]"
                } ${isPlanActive ? "ring-1 ring-emerald-400/50" : ""}`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-2 left-3 sm:left-4 bg-gold/20 text-gold text-[10px] px-2 py-0.5 rounded">
                    POPULAR
                  </span>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-ui text-xs sm:text-sm uppercase tracking-wider text-cream mb-0.5 sm:mb-1">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1 flex-wrap">
                      {plan.price === null ? (
                        <span className="text-lg sm:text-xl font-semibold text-cream">Custom pricing</span>
                      ) : (
                        <>
                          <span className="text-xl sm:text-2xl font-semibold text-cream tabular-nums">
                            {plan.price === 0 ? "Free" : `₹${plan.price}`}
                          </span>
                          {plan.price > 0 && (
                            <span className="text-cream/50 text-[11px] sm:text-xs">/{plan.period}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onFreeTier) return;
                      if (plan.cta === "mailto") {
                        openSalesMail(plan);
                        return;
                      }
                      void handleSubscribe(plan.id);
                    }}
                    disabled={
                      loading ||
                      isPlanActive ||
                      onFreeTier ||
                      (isFree && !isCurrentPlan)
                    }
                    className={`shrink-0 py-2 px-3 sm:px-4 rounded-lg text-[10px] sm:text-xs font-ui uppercase tracking-wider transition-all ${
                      isPlanActive || onFreeTier
                        ? "bg-emerald-500/15 text-emerald-300/90 border border-emerald-500/25 cursor-default"
                        : plan.highlighted
                          ? "bg-gold/20 text-gold border border-gold/40 hover:bg-gold/30"
                          : isSales
                            ? "bg-teal/15 text-teal-m border border-teal/35 hover:bg-teal/25"
                            : "bg-white/[0.05] text-cream border border-white/[0.12] hover:bg-white/[0.08]"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {ctaLabel}
                  </button>
                </div>

                <ul className="space-y-1 sm:space-y-1.5 mt-2.5 sm:mt-3">
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      className="text-[11px] sm:text-xs text-cream/70 flex items-start gap-2 leading-snug"
                    >
                      <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isSales && (
                  <p className="mt-2 font-ui text-[9px] text-cream/30">
                    Opens email to {SALES_EMAIL} — pay only after sales confirmation.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-cream/30 text-center">
        Self-serve checkout via Razorpay for Pro &amp; Pro Plus • Cancel anytime • SSL encrypted
      </p>
    </div>
  );
}
