import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { freeOracleDailyCap, isOracleFullTier } from "@/lib/product-access";

type ProfilePlan = {
  subscription_status: string;
  subscription_plan: string;
};

export async function POST() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: true, anonymous: true });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_plan")
    .eq("id", user.id)
    .single();

  if (isOracleFullTier(profile as ProfilePlan | null)) {
    return NextResponse.json({ ok: true, unlimited: true });
  }

  const cap = freeOracleDailyCap();
  let svc: ReturnType<typeof createServiceRoleClient>;
  try {
    svc = createServiceRoleClient();
  } catch {
    console.warn("[oracle-consume] SUPABASE_SERVICE_ROLE_KEY missing — quota not enforced server-side");
    return NextResponse.json({ ok: true, serverQuotaSkipped: true });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: row, error: selErr } = await svc
    .from("profiles")
    .select("oracle_limited_day, oracle_limited_used")
    .eq("id", user.id)
    .single();

  if (selErr || !row) {
    return NextResponse.json({ ok: true, serverQuotaSkipped: true });
  }

  let used = (row as { oracle_limited_used?: number }).oracle_limited_used ?? 0;
  const day = (row as { oracle_limited_day?: string | null }).oracle_limited_day;
  if (day !== today) {
    used = 0;
  }
  if (used >= cap) {
    return NextResponse.json(
      { ok: false, cap, used },
      { status: 429 }
    );
  }

  const { error: upErr } = await svc
    .from("profiles")
    .update({
      oracle_limited_day: today,
      oracle_limited_used: used + 1,
    })
    .eq("id", user.id);

  if (upErr) {
    return NextResponse.json({ ok: true, serverQuotaSkipped: true });
  }

  return NextResponse.json({ ok: true, used: used + 1, cap });
}
