/**
 * Razorpay Client Configuration
 * Handles payment processing, subscriptions, and customer management
 */
import Razorpay from "razorpay";

// Validate environment variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn("Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local");
}

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
});

// Plan IDs from Razorpay Dashboard
export const RAZORPAY_PLANS = {
  free: null, // No Razorpay plan for free tier
  basic: process.env.RAZORPAY_PLAN_BASIC_ID, // Create in dashboard
  pro: process.env.RAZORPAY_PLAN_PRO_ID,
  enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE_ID,
} as const;

export type PlanId = keyof typeof RAZORPAY_PLANS;

export interface SubscriptionDetails {
  id: string;
  status: "created" | "active" | "cancelled" | "paused" | "expired";
  current_end: number; // Unix timestamp
  current_start: number; // Unix timestamp
  plan_id: string;
  customer_id: string;
}

export interface CustomerDetails {
  id: string;
  email: string;
  name?: string;
}

/**
 * Create a new Razorpay customer
 */
export async function createRazorpayCustomer(
  email: string,
  name?: string
): Promise<CustomerDetails> {
  const customer = await razorpay.customers.create({
    email,
    name: name || email,
  });

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
  };
}

/**
 * Create a new subscription for a customer
 */
export async function createRazorpaySubscription(
  customerId: string,
  planId: string
): Promise<SubscriptionDetails> {
  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_id: customerId,
    total_count: 12, // 12 months, or omit for ongoing
    customer_notify: 1, // Notify customer via email
  });

  return {
    id: subscription.id,
    status: subscription.status as SubscriptionDetails["status"],
    current_end: subscription.current_end,
    current_start: subscription.current_start,
    plan_id: subscription.plan_id,
    customer_id: subscription.customer_id,
  };
}

/**
 * Cancel a subscription
 */
export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtEndOfPeriod: boolean = true
): Promise<void> {
  if (cancelAtEndOfPeriod) {
    // Cancel at end of current billing cycle
    await razorpay.subscriptions.cancel(subscriptionId, {
      cancel_at_cycle_end: true,
    });
  } else {
    // Cancel immediately
    await razorpay.subscriptions.cancel(subscriptionId);
  }
}

/**
 * Get subscription details
 */
export async function getRazorpaySubscription(
  subscriptionId: string
): Promise<SubscriptionDetails> {
  const subscription = await razorpay.subscriptions.fetch(subscriptionId);

  return {
    id: subscription.id,
    status: subscription.status as SubscriptionDetails["status"],
    current_end: subscription.current_end,
    current_start: subscription.current_start,
    plan_id: subscription.plan_id,
    customer_id: subscription.customer_id,
  };
}

/**
 * Verify Razorpay webhook signature
 * Prevents spoofed webhook calls
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

/**
 * Map Razorpay plan ID to internal plan name
 */
export function getPlanNameFromRazorpayId(planId: string): PlanId {
  if (planId === process.env.RAZORPAY_PLAN_PRO_ID) return "pro";
  if (planId === process.env.RAZORPAY_PLAN_ENTERPRISE_ID) return "enterprise";
  if (planId === process.env.RAZORPAY_PLAN_BASIC_ID) return "basic";
  return "basic"; // Default fallback
}

/**
 * Get scans limit for each plan
 */
export function getScansLimitForPlan(plan: PlanId): number {
  switch (plan) {
    case "free":
      return 10;
    case "basic":
      return 100;
    case "pro":
    case "enterprise":
      return Infinity;
    default:
      return 10;
  }
}
