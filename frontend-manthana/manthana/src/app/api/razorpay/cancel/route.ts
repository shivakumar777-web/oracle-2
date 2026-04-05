/**
 * Cancel Razorpay Subscription
 * Allows users to cancel their active subscription
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cancelRazorpaySubscription } from "@/lib/razorpay/client";
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "auth.db");

export async function POST(req: Request) {
  try {
    // Get current user session
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

    // Check if user has an active subscription
    if (!user.razorpaySubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    // Cancel the subscription at end of period
    await cancelRazorpaySubscription(user.razorpaySubscriptionId, true);

    // Update user record to mark as cancelled
    const db = new Database(dbPath);
    try {
      db.prepare(
        `
        UPDATE user 
        SET subscriptionStatus = 'cancelled'
        WHERE id = ?
      `
      ).run(user.id);

      console.log(
        `[Subscription Cancel] User ${user.id} cancelled subscription ${user.razorpaySubscriptionId}`
      );

      return NextResponse.json({
        success: true,
        message:
          "Subscription cancelled. You'll keep access until the end of your billing period.",
      });
    } finally {
      db.close();
    }
  } catch (error: any) {
    console.error("[Subscription Cancel] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
