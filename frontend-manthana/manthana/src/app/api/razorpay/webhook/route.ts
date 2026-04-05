/**
 * Razorpay Webhook Handler
 * Updates user subscription status on payment events
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Database from "better-sqlite3";
import path from "path";
import { sendPaymentReceipt } from "@/lib/email/ses";
import {
  verifyWebhookSignature,
  getPlanNameFromRazorpayId,
  getScansLimitForPlan,
  PlanId,
} from "@/lib/razorpay/client";

const dbPath = path.join(process.cwd(), "auth.db");

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  // Verify webhook authenticity
  const isValid = verifyWebhookSignature(
    body,
    signature,
    process.env.RAZORPAY_WEBHOOK_SECRET || ""
  );

  if (!isValid) {
    console.error("Invalid Razorpay webhook signature");
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const event = JSON.parse(body);

  // Connect to database
  const db = new Database(dbPath);

  try {
    console.log(`[Razorpay Webhook] Event: ${event.event}`);

    switch (event.event) {
      case "subscription.activated":
      case "subscription.charged": {
        const subscription = event.payload.subscription.entity;
        const payment = event.payload.payment?.entity;

        // Find user by razorpayCustomerId
        const user = db
          .prepare("SELECT * FROM user WHERE razorpayCustomerId = ?")
          .get(subscription.customer_id) as
          | {
              id: string;
              email: string;
              name?: string;
              razorpayCustomerId?: string;
            }
          | undefined;

        if (user) {
          // Determine plan from razorpay plan_id
          const planName = getPlanNameFromRazorpayId(subscription.plan_id);
          const scansLimit = getScansLimitForPlan(planName);

          // Update user subscription status
          db.prepare(
            `
            UPDATE user 
            SET subscriptionStatus = 'active',
                subscriptionPlan = ?,
                razorpaySubscriptionId = ?,
                subscriptionExpiresAt = ?,
                scansLimit = ?,
                scansThisMonth = 0
            WHERE id = ?
          `
          ).run(
            planName,
            subscription.id,
            subscription.current_end,
            scansLimit,
            user.id
          );

          console.log(
            `[Razorpay Webhook] User ${user.id} subscription activated: ${planName}`
          );

          // Send payment receipt email
          if (payment) {
            try {
              await sendPaymentReceipt(
                user.email,
                payment.amount / 100, // Convert from paise to rupees
                planName,
                payment.invoice_id || subscription.id
              );
              console.log(
                `[Razorpay Webhook] Payment receipt sent to ${user.email}`
              );
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
        const subscription = event.payload.subscription.entity;

        db.prepare(
          `
          UPDATE user 
          SET subscriptionStatus = 'cancelled',
              subscriptionPlan = 'free',
              scansLimit = 10
          WHERE razorpaySubscriptionId = ?
        `
        ).run(subscription.id);

        console.log(
          `[Razorpay Webhook] Subscription ${subscription.id} cancelled`
        );
        break;
      }

      case "subscription.expired": {
        const subscription = event.payload.subscription.entity;

        db.prepare(
          `
          UPDATE user 
          SET subscriptionStatus = 'inactive',
              subscriptionPlan = 'free',
              razorpaySubscriptionId = NULL,
              subscriptionExpiresAt = NULL,
              scansLimit = 10
          WHERE razorpaySubscriptionId = ?
        `
        ).run(subscription.id);

        console.log(
          `[Razorpay Webhook] Subscription ${subscription.id} expired`
        );
        break;
      }

      case "subscription.pending": {
        // Payment failed but subscription exists - mark past_due
        const subscription = event.payload.subscription.entity;

        db.prepare(
          `
          UPDATE user 
          SET subscriptionStatus = 'past_due'
          WHERE razorpaySubscriptionId = ?
        `
        ).run(subscription.id);

        console.warn(
          `[Razorpay Webhook] Subscription ${subscription.id} marked as past_due`
        );
        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment.entity;
        console.error(
          `[Razorpay Webhook] Payment failed for order ${payment.order_id}`
        );
        // Could add user notification here
        break;
      }

      default: {
        console.log(`[Razorpay Webhook] Unhandled event: ${event.event}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Razorpay Webhook] Processing error:", error);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  } finally {
    db.close();
  }
}
