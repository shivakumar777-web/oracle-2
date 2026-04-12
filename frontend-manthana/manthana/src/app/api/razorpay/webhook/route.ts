/**
 * Razorpay Webhook Handler
 * Updates user subscription status on payment events
 */
import { NextResponse } from "next/server";
import { sendPaymentReceipt } from "@/lib/email/ses";
import {
  verifyWebhookSignature,
  getPlanNameFromRazorpayId,
  getScansLimitForPlan,
} from "@/lib/razorpay/client";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const isValid = verifyWebhookSignature(
    body,
    signature,
    process.env.RAZORPAY_WEBHOOK_SECRET || ""
  );

  if (!isValid) {
    console.error("Invalid Razorpay webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body) as { event: string; payload: Record<string, { entity: Record<string, unknown> }> };

  const supabase = createServiceRoleClient();

  try {
    console.log(`[Razorpay Webhook] Event: ${event.event}`);

    switch (event.event) {
      case "subscription.activated":
      case "subscription.charged": {
        const subscription = event.payload.subscription.entity as {
          id: string;
          customer_id: string;
          plan_id: string;
          current_end: number;
        };
        const payment = event.payload.payment?.entity as
          | { amount: number; invoice_id?: string }
          | undefined;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("razorpay_customer_id", subscription.customer_id)
          .maybeSingle();

        if (profile?.id) {
          const planName = getPlanNameFromRazorpayId(subscription.plan_id);
          const scansLimit = getScansLimitForPlan(planName);
          const curMonth = new Date().toISOString().slice(0, 7);
          const curDay = new Date().toISOString().slice(0, 10);

          const labsReset =
            planName === "pro"
              ? {
                  labs_usage_month: curMonth,
                  labs_light_count: 0,
                  labs_ct_mri_count: 0,
                  labs_medium_count: 0,
                  labs_usage_day: curDay,
                  labs_scans_today: 0,
                }
              : planName === "proplus"
                ? {
                    labs_usage_month: curMonth,
                    labs_light_count: 0,
                    labs_ct_mri_count: 0,
                    labs_medium_count: 0,
                    labs_usage_day: curDay,
                    labs_scans_today: 0,
                  }
                : {};

          const { error: upErr } = await supabase
            .from("profiles")
            .update({
              subscription_status: "active",
              subscription_plan: planName,
              razorpay_subscription_id: subscription.id,
              subscription_expires_at: subscription.current_end,
              scans_limit: scansLimit,
              scans_this_month: 0,
              ...labsReset,
            })
            .eq("id", profile.id);

          if (upErr) {
            console.error("[Razorpay Webhook] Update failed:", upErr);
          } else {
            console.log(
              `[Razorpay Webhook] User ${profile.id} subscription activated: ${planName}`
            );
          }

          const { data: userRow } = await supabase.auth.admin.getUserById(
            profile.id
          );
          const email = userRow.user?.email;

          if (payment && email) {
            try {
              await sendPaymentReceipt(
                email,
                payment.amount / 100,
                planName,
                payment.invoice_id || subscription.id
              );
              console.log(`[Razorpay Webhook] Payment receipt sent to ${email}`);
            } catch (emailError) {
              console.error(
                "[Razorpay Webhook] Failed to send payment receipt:",
                emailError
              );
            }
          }
        } else {
          console.warn(
            `[Razorpay Webhook] No user found for customer ${subscription.customer_id}`
          );
        }
        break;
      }

      case "subscription.cancelled": {
        const subscription = event.payload.subscription.entity as { id: string };

        const { error } = await supabase
          .from("profiles")
          .update({
            subscription_status: "cancelled",
            subscription_plan: "free",
            scans_limit: 10,
            labs_usage_month: null,
            labs_usage_day: null,
            labs_light_count: 0,
            labs_ct_mri_count: 0,
            labs_medium_count: 0,
            labs_scans_today: 0,
          })
          .eq("razorpay_subscription_id", subscription.id);

        if (error) {
          console.error("[Razorpay Webhook] cancel update:", error);
        }

        console.log(
          `[Razorpay Webhook] Subscription ${subscription.id} cancelled`
        );
        break;
      }

      case "subscription.expired": {
        const subscription = event.payload.subscription.entity as { id: string };

        const { error } = await supabase
          .from("profiles")
          .update({
            subscription_status: "inactive",
            subscription_plan: "free",
            razorpay_subscription_id: null,
            subscription_expires_at: null,
            scans_limit: 10,
            labs_usage_month: null,
            labs_usage_day: null,
            labs_light_count: 0,
            labs_ct_mri_count: 0,
            labs_medium_count: 0,
            labs_scans_today: 0,
          })
          .eq("razorpay_subscription_id", subscription.id);

        if (error) {
          console.error("[Razorpay Webhook] expired update:", error);
        }

        console.log(`[Razorpay Webhook] Subscription ${subscription.id} expired`);
        break;
      }

      case "subscription.pending": {
        const subscription = event.payload.subscription.entity as { id: string };

        const { error } = await supabase
          .from("profiles")
          .update({ subscription_status: "past_due" })
          .eq("razorpay_subscription_id", subscription.id);

        if (error) {
          console.error("[Razorpay Webhook] pending update:", error);
        }

        console.warn(
          `[Razorpay Webhook] Subscription ${subscription.id} marked as past_due`
        );
        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment.entity as { order_id?: string };
        console.error(
          `[Razorpay Webhook] Payment failed for order ${payment.order_id}`
        );
        break;
      }

      default: {
        console.log(`[Razorpay Webhook] Unhandled event: ${event.event}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Razorpay Webhook] Processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
