/**
 * Cancel Razorpay Subscription
 * Allows users to cancel their active subscription
 */
import { NextResponse } from "next/server";
import { cancelRazorpaySubscription } from "@/lib/razorpay/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("razorpay_subscription_id")
      .eq("id", user.id)
      .single();

    if (pErr || !profile?.razorpay_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    const subId = profile.razorpay_subscription_id as string;

    await cancelRazorpaySubscription(subId, true);

    const { error: upErr } = await supabase
      .from("profiles")
      .update({ subscription_status: "cancelled" })
      .eq("id", user.id);

    if (upErr) {
      console.error("[Subscription Cancel] DB update:", upErr);
      return NextResponse.json(
        { error: "Failed to update subscription status" },
        { status: 500 }
      );
    }

    console.log(
      `[Subscription Cancel] User ${user.id} cancelled subscription ${subId}`
    );

    return NextResponse.json({
      success: true,
      message:
        "Subscription cancelled. You'll keep access until the end of your billing period.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Subscription Cancel] Error:", error);
    return NextResponse.json(
      { error: message || "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
