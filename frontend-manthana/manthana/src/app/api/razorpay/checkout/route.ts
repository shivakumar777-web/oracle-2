/**
 * Create Razorpay Checkout Session
 * Called when user clicks "Subscribe" button
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  RAZORPAY_PLANS,
  PlanId,
  SCANS_LIMIT_UNLIMITED_SENTINEL,
  createRazorpayCustomer,
  createRazorpaySubscription,
} from "@/lib/razorpay/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  FREE_LABS_TRIAL_TOTAL,
  freeOracleDailyCap,
  labsTrialRemainingForProfile,
  normalizeSubscriptionPlan,
  profileForLabsAccess,
} from "@/lib/product-access";
import { labsLimitsForPlan } from "@/lib/labs/modality-tier";

type ProfileRow = {
  id: string;
  subscription_status: string;
  subscription_plan: string;
  scans_this_month: number;
  scans_limit: number;
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  subscription_expires_at: number | null;
};

async function ensureProfile(
  userId: string,
  userClient: ReturnType<typeof createServerSupabaseClient>
): Promise<ProfileRow | null> {
  const { data: row } = await userClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (row) return row as ProfileRow;

  const svc = createServiceRoleClient();
  const { data: inserted, error } = await svc
    .from("profiles")
    .upsert({ id: userId }, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    console.error("[Checkout] ensureProfile:", error);
    return null;
  }
  return inserted as ProfileRow;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { plan }: { plan: PlanId } = body;

    if (!plan || plan === "free") {
      return NextResponse.json(
        { error: "Invalid plan - must be paid plan" },
        { status: 400 }
      );
    }

    const planId = RAZORPAY_PLANS[plan];
    if (!planId) {
      return NextResponse.json(
        { error: `Plan ${plan} not configured. Add plan ID to .env.local` },
        { status: 500 }
      );
    }

    const profile = await ensureProfile(user.id, supabase);
    if (!profile) {
      return NextResponse.json(
        { error: "Profile not available" },
        { status: 500 }
      );
    }

    let customerId = profile.razorpay_customer_id ?? undefined;
    const displayName =
      (user.user_metadata as { full_name?: string })?.full_name ??
      user.email.split("@")[0] ??
      user.email;

    try {
      if (!customerId) {
        console.log(`[Checkout] Creating Razorpay customer for user ${user.id}`);
        const customer = await createRazorpayCustomer(user.email, displayName);
        customerId = customer.id;

        const { error: upErr } = await supabase
          .from("profiles")
          .update({ razorpay_customer_id: customerId })
          .eq("id", user.id);

        if (upErr) {
          console.error("[Checkout] Failed to save customer id:", upErr);
          return NextResponse.json(
            { error: "Failed to save billing profile" },
            { status: 500 }
          );
        }

        console.log(
          `[Checkout] Created Razorpay customer ${customerId} for user ${user.id}`
        );
      } else {
        console.log(`[Checkout] Using existing Razorpay customer ${customerId}`);
      }

      const subscription = await createRazorpaySubscription(customerId, planId);

      console.log(
        `[Checkout] Created subscription ${subscription.id} for user ${user.id}, plan: ${plan}`
      );

      const { error: subErr } = await supabase
        .from("profiles")
        .update({
          razorpay_subscription_id: subscription.id,
          subscription_plan: plan,
          subscription_status: "inactive",
        })
        .eq("id", user.id);

      if (subErr) {
        console.error("[Checkout] Failed to update subscription:", subErr);
        return NextResponse.json(
          { error: "Failed to update subscription" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        subscriptionId: subscription.id,
        status: subscription.status,
        message: "Subscription created. Payment required to activate.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[Checkout] Error creating subscription:", error);
      return NextResponse.json(
        {
          error: message || "Failed to create subscription. Please try again.",
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Checkout] Error:", error);
    return NextResponse.json(
      { error: message || "Failed to create subscription. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const profile = await ensureProfile(user.id, supabase);
    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const planNorm = normalizeSubscriptionPlan(profile.subscription_plan);
    const active = profile.subscription_status === "active";
    const paidLabsPlan =
      active && planNorm === "proplus"
        ? ("proplus" as const)
        : active && planNorm === "pro"
          ? ("pro" as const)
          : null;

    const unlimited =
      profile.scans_limit >= SCANS_LIMIT_UNLIMITED_SENTINEL && !paidLabsPlan;

    const curMonth = new Date().toISOString().slice(0, 7);
    const curDay = new Date().toISOString().slice(0, 10);
    const p = profile as Record<string, unknown>;
    let light = (p.labs_light_count as number) ?? 0;
    let ctMri = (p.labs_ct_mri_count as number) ?? 0;
    let medium = (p.labs_medium_count as number) ?? 0;
    let totalUsed = profile.scans_this_month ?? 0;
    let today = (p.labs_scans_today as number) ?? 0;
    if ((p.labs_usage_month as string | null) !== curMonth) {
      light = 0;
      ctMri = 0;
      medium = 0;
      totalUsed = 0;
      today = 0;
    } else if ((p.labs_usage_day as string | null) !== curDay) {
      today = 0;
    }

    const L = paidLabsPlan ? labsLimitsForPlan(paidLabsPlan) : null;
    const labsUsage = L
      ? {
          plan: paidLabsPlan,
          dailyMax: L.dailyMax,
          lightCap: L.lightMonthly,
          ctMriCap: L.ctMriMonthly,
          mediumCap: L.mediumMonthly,
          monthlyCap: L.totalMonthly,
          lightUsed: light,
          lightRemaining: Math.max(0, L.lightMonthly - light),
          ctMriUsed: ctMri,
          ctMriRemaining: Math.max(0, L.ctMriMonthly - ctMri),
          mediumUsed: medium,
          mediumRemaining: Math.max(0, L.mediumMonthly - medium),
          totalUsed,
          totalRemaining: Math.max(0, L.totalMonthly - totalUsed),
          todayUsed: today,
          todayRemaining: Math.max(0, L.dailyMax - today),
          pro2dOnly: paidLabsPlan === "pro" || paidLabsPlan === "proplus",
        }
      : null;

    const accessProfile = profileForLabsAccess({
      subscription_status: profile.subscription_status,
      subscription_plan: profile.subscription_plan,
      labs_free_trial_used:
        (profile as Record<string, unknown>).labs_free_trial_used as
          | number
          | null
          | undefined,
    });
    const trialRemaining = labsTrialRemainingForProfile(accessProfile);
    const labsLifetimeTrial =
      paidLabsPlan == null
        ? {
            total: FREE_LABS_TRIAL_TOTAL,
            used: Math.min(
              FREE_LABS_TRIAL_TOTAL,
              Math.max(0, accessProfile.labs_free_trial_used ?? 0)
            ),
            remaining: trialRemaining ?? 0,
          }
        : null;

    const scansLimitOut = paidLabsPlan
      ? L!.totalMonthly
      : unlimited
        ? SCANS_LIMIT_UNLIMITED_SENTINEL
        : 0;
    const scansRemainingOut = paidLabsPlan
      ? Math.max(0, scansLimitOut - (profile.scans_this_month ?? 0))
      : unlimited
        ? SCANS_LIMIT_UNLIMITED_SENTINEL
        : 0;

    return NextResponse.json({
      status: profile.subscription_status,
      plan: planNorm,
      subscriptionId: profile.razorpay_subscription_id ?? undefined,
      expiresAt: profile.subscription_expires_at ?? undefined,
      scansUsed: profile.scans_this_month,
      scansLimit: scansLimitOut,
      scansRemaining: scansRemainingOut,
      /** Free / non-subscription: no monthly Oracle “scans” bar — use labsLifetimeTrial + oracleDailyCap */
      monthlyScansBar: Boolean(paidLabsPlan || unlimited),
      oracleDailyCap: freeOracleDailyCap(),
      labsLifetimeTrial,
      labsUsage,
    });
  } catch (error: unknown) {
    console.error("[Checkout] Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription status" },
      { status: 500 }
    );
  }
}
