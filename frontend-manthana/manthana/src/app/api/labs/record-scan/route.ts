import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { labsScanTierForModality } from "@/lib/labs/modality-tier";
import { labsQuotaMessage } from "@/lib/labs/quota-messages";
import type { PaidLabsPlan } from "@/lib/labs/modality-tier";
import {
  FREE_LABS_TRIAL_TOTAL,
  hasActiveProLabsPlan,
} from "@/lib/product-access";

/**
 * Record one successful Labs analyze: Pro/Premium via RPC, or free-tier lifetime trial counter.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { modalityId?: string };
    const modalityId = (body.modalityId || "").trim();
    if (!modalityId) {
      return NextResponse.json({ error: "modalityId required" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tier = labsScanTierForModality(modalityId);

    let svc;
    try {
      svc = createServiceRoleClient();
    } catch {
      console.warn("[labs/record-scan] No SUPABASE_SERVICE_ROLE_KEY — quota not persisted");
      return NextResponse.json({ ok: true, serverSkipped: true });
    }

    let { data: prof, error: profErr } = await svc
      .from("profiles")
      .select("subscription_status, subscription_plan, labs_free_trial_used")
      .eq("id", user.id)
      .single();

    if (profErr || !prof) {
      const ins = await svc.from("profiles").insert({ id: user.id }).select("subscription_status, subscription_plan, labs_free_trial_used").single();
      if (!ins.error && ins.data) {
        prof = ins.data;
      } else {
        const again = await svc
          .from("profiles")
          .select("subscription_status, subscription_plan, labs_free_trial_used")
          .eq("id", user.id)
          .single();
        prof = again.data;
        if (!prof) {
          console.error("[labs/record-scan] profile:", profErr, ins.error);
          return NextResponse.json({ error: "no_profile" }, { status: 400 });
        }
      }
    }

    if (
      hasActiveProLabsPlan({
        subscription_status: prof.subscription_status,
        subscription_plan: prof.subscription_plan,
        labs_free_trial_used: prof.labs_free_trial_used,
      })
    ) {
      const { data, error } = await svc.rpc("consume_labs_scan", {
        p_user_id: user.id,
        p_tier: tier,
      });

      if (error) {
        console.error("[labs/record-scan] RPC error:", error);
        return NextResponse.json(
          { error: "Quota update failed", detail: error.message },
          { status: 500 }
        );
      }

      const result = data as {
        ok?: boolean;
        error?: string;
        limit?: number;
        plan?: string;
      };
      if (!result?.ok) {
        const code = result?.error ?? "quota";
        const status =
          code === "daily_cap" || code.endsWith("_cap") || code === "monthly_total"
            ? 429
            : 403;
        const planNorm =
          result?.plan === "proplus" ||
          result?.plan === "pro" ||
          result?.plan === "premium" ||
          result?.plan === "enterprise"
            ? (result.plan as PaidLabsPlan)
            : undefined;
        return NextResponse.json(
          {
            error: code,
            limit: result?.limit,
            tier,
            message: labsQuotaMessage(code, result?.limit, planNorm),
          },
          { status }
        );
      }

      return NextResponse.json({ ok: true, tier });
    }

    const used = prof.labs_free_trial_used ?? 0;
    if (used >= FREE_LABS_TRIAL_TOTAL) {
      return NextResponse.json(
        {
          error: "trial_exhausted",
          limit: FREE_LABS_TRIAL_TOTAL,
          tier,
          message: labsQuotaMessage("trial_exhausted", FREE_LABS_TRIAL_TOTAL),
        },
        { status: 429 }
      );
    }

    const { data: updated, error: upErr } = await svc
      .from("profiles")
      .update({
        labs_free_trial_used: used + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .eq("labs_free_trial_used", used)
      .select("id");

    if (upErr) {
      console.error("[labs/record-scan] trial increment:", upErr);
      return NextResponse.json({ error: "Quota update failed" }, { status: 500 });
    }
    if (!updated?.length) {
      return NextResponse.json(
        {
          error: "trial_exhausted",
          limit: FREE_LABS_TRIAL_TOTAL,
          tier,
          message: labsQuotaMessage("trial_exhausted", FREE_LABS_TRIAL_TOTAL),
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ ok: true, tier, plan: "free_trial" });
  } catch (e) {
    console.error("[labs/record-scan]", e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
