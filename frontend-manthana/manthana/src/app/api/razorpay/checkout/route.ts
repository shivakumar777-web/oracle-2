/**
 * Create Razorpay Checkout Session
 * Called when user clicks "Subscribe" button
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  razorpay,
  RAZORPAY_PLANS,
  PlanId,
  createRazorpayCustomer,
  createRazorpaySubscription,
} from "@/lib/razorpay/client";
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "auth.db");

export async function POST(req: Request) {
  try {
    // Get current user session from Better Auth
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = session.user;
    const body = await req.json();
    const { plan }: { plan: PlanId } = body;

    // Validate plan
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

    // Connect to database
    const db = new Database(dbPath);

    // Get or create Razorpay customer
    let customerId = user.razorpayCustomerId;

    try {
      if (!customerId) {
        console.log(`[Checkout] Creating Razorpay customer for user ${user.id}`);
        const customer = await createRazorpayCustomer(
          user.email,
          user.name || user.email
        );

        customerId = customer.id;

        // Save customer ID to user record
        db.prepare(
          "UPDATE user SET razorpayCustomerId = ? WHERE id = ?"
        ).run(customerId, user.id);

        console.log(
          `[Checkout] Created Razorpay customer ${customerId} for user ${user.id}`
        );
      } else {
        console.log(
          `[Checkout] Using existing Razorpay customer ${customerId}`
        );
      }

      // Create subscription
      const subscription = await createRazorpaySubscription(customerId, planId);

      console.log(
        `[Checkout] Created subscription ${subscription.id} for user ${user.id}, plan: ${plan}`
      );

      // Update user record with subscription details
      db.prepare(
        `
        UPDATE user 
        SET razorpaySubscriptionId = ?,
            subscriptionPlan = ?,
            subscriptionStatus = 'inactive'
        WHERE id = ?
      `
      ).run(subscription.id, plan, user.id);

      return NextResponse.json({
        subscriptionId: subscription.id,
        status: subscription.status,
        message: "Subscription created. Payment required to activate.",
      });
    } finally {
      db.close();
    }
  } catch (error: any) {
    console.error("[Checkout] Error creating subscription:", error);
    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create subscription. Please try again.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Check current subscription status
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = session.user;
    const db = new Database(dbPath);

    try {
      const userData = db
        .prepare(
          `
          SELECT 
            subscriptionStatus,
            subscriptionPlan,
            razorpaySubscriptionId,
            subscriptionExpiresAt,
            scansThisMonth,
            scansLimit
          FROM user 
          WHERE id = ?
        `
        )
        .get(user.id) as
        | {
            subscriptionStatus: string;
            subscriptionPlan: string;
            razorpaySubscriptionId?: string;
            subscriptionExpiresAt?: number;
            scansThisMonth: number;
            scansLimit: number;
          }
        | undefined;

      if (!userData) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        status: userData.subscriptionStatus,
        plan: userData.subscriptionPlan,
        subscriptionId: userData.razorpaySubscriptionId,
        expiresAt: userData.subscriptionExpiresAt,
        scansUsed: userData.scansThisMonth,
        scansLimit: userData.scansLimit,
        scansRemaining: userData.scansLimit - userData.scansThisMonth,
      });
    } finally {
      db.close();
    }
  } catch (error: any) {
    console.error("[Checkout] Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription status" },
      { status: 500 }
    );
  }
}
