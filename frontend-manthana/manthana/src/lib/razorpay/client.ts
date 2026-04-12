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

/** Pro Plus Razorpay plan id; falls back to legacy RAZORPAY_PLAN_ENTERPRISE_ID if unset. */
const PROPLUS_PLAN_ID =
  process.env.RAZORPAY_PLAN_PROPLUS_ID?.trim() ||
  process.env.RAZORPAY_PLAN_ENTERPRISE_ID?.trim();

// Plan IDs from Razorpay Dashboard
export const RAZORPAY_PLANS = {
  free: null, // No Razorpay plan for free tier
  /** Legacy subscriptions only — not offered in current product UI */
  basic: process.env.RAZORPAY_PLAN_BASIC_ID,
  pro: process.env.RAZORPAY_PLAN_PRO_ID,
  proplus: PROPLUS_PLAN_ID,
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
    email: customer.email ?? email,
    name: customer.name,
  };
}

/** Normalize Razorpay subscription fields (API allows nulls; SDK create types omit `customer_id`). */
function subscriptionFromRazorpay(sub: {
  id: string;
  status: string;
  current_end?: number | null;
  current_start?: number | null;
  plan_id: string;
  customer_id?: string | null;
}): SubscriptionDetails {
  return {
    id: sub.id,
    status: sub.status as SubscriptionDetails["status"],
    current_end: sub.current_end ?? 0,
    current_start: sub.current_start ?? 0,
    plan_id: sub.plan_id,
    customer_id: sub.customer_id ?? "",
  };
}

/**
 * Create a new subscription for a customer
 */
export async function createRazorpaySubscription(
  customerId: string,
  planId: string
): Promise<SubscriptionDetails> {
  // SDK `RazorpaySubscriptionCreateRequestBody` omits `customer_id`; API accepts it.
  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_id: customerId,
    total_count: 12,
    customer_notify: 1,
  } as never);

  return subscriptionFromRazorpay(subscription);
}

/**
 * Cancel a subscription
 */
export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtEndOfPeriod: boolean = true
): Promise<void> {
  // Second arg: `true` / non-zero = end of cycle; `false` / `0` = immediate (per SDK typings).
  await razorpay.subscriptions.cancel(subscriptionId, cancelAtEndOfPeriod);
}

/**
 * Get subscription details
 */
export async function getRazorpaySubscription(
  subscriptionId: string
): Promise<SubscriptionDetails> {
  const subscription = await razorpay.subscriptions.fetch(subscriptionId);

  return subscriptionFromRazorpay(subscription);
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
  if (
    planId === process.env.RAZORPAY_PLAN_PROPLUS_ID ||
    planId === process.env.RAZORPAY_PLAN_ENTERPRISE_ID
  ) {
    return "proplus";
  }
  if (planId === process.env.RAZORPAY_PLAN_BASIC_ID) return "basic";
  return "basic";
}

/** Stored in Postgres when plan has unlimited scans (Infinity is not JSON/DB-safe). */
export const SCANS_LIMIT_UNLIMITED_SENTINEL = 99_999_999;

/** Active Pro (₹399): monthly Labs cap enforced in app + `consume_labs_scan` RPC. */
export const PRO_LABS_MONTHLY_SCAN_CAP = 150;

/**
 * Get scans limit for each plan
 */
export function getScansLimitForPlan(plan: PlanId): number {
  switch (plan) {
    case "free":
      return 0;
    case "basic":
      return 100;
    case "pro":
      return PRO_LABS_MONTHLY_SCAN_CAP;
    case "proplus":
      return PRO_LABS_MONTHLY_SCAN_CAP;
    default:
      return 0;
  }
}
