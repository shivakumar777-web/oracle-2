/**
 * Better Auth — server config with SES email and subscription hooks
 * Handles sign-in, sign-up, sessions, and JWT for Python backend validation.
 *
 * Email verification must live under `emailVerification` (Better Auth docs).
 * Password reset uses `sendResetPassword` on `emailAndPassword` (not sendResetPasswordEmail).
 */
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import Database from "better-sqlite3";
import path from "path";
import { sendVerificationEmail, sendEmail } from "./email/ses";

const dbPath = path.join(process.cwd(), "auth.db");

// Validate required environment variables
function validateAuthConfig() {
  const missing: string[] = [];

  if (!process.env.BETTER_AUTH_SECRET) {
    missing.push("BETTER_AUTH_SECRET");
  }

  if (!process.env.BETTER_AUTH_URL && !process.env.NEXT_PUBLIC_APP_URL) {
    missing.push("BETTER_AUTH_URL (or NEXT_PUBLIC_APP_URL)");
  }

  if (missing.length > 0) {
    console.error("[AUTH] ❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`       - ${key}`));
    console.error("[AUTH] Please check your .env.local file");
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  console.log("[AUTH] ✅ Configuration validated");
  console.log(`[AUTH]    Database: ${dbPath}`);
  console.log(`[AUTH]    BaseURL: ${process.env.BETTER_AUTH_URL || "http://localhost:3001"}`);
}

validateAuthConfig();

export const auth = betterAuth({
  database: new Database(dbPath),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",

  user: {
    additionalFields: {
      subscriptionStatus: {
        type: "string",
        required: false,
        defaultValue: "inactive",
      },
      subscriptionPlan: {
        type: "string",
        required: false,
        defaultValue: "free",
      },
      scansThisMonth: {
        type: "number",
        required: false,
        defaultValue: 0,
      },
      scansLimit: {
        type: "number",
        required: false,
        defaultValue: 10,
      },
      razorpayCustomerId: { type: "string", required: false },
      razorpaySubscriptionId: { type: "string", required: false },
      subscriptionExpiresAt: { type: "number", required: false },
    },
  },

  emailVerification: {
    /** Send verification link when user signs up (uses SES). */
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`[AUTH] Sending verification email to: ${user.email}`);
      try {
        await sendVerificationEmail(user.email, url);
        console.log(`[AUTH] ✅ Verification email sent to: ${user.email}`);
      } catch (error: any) {
        console.error(`[AUTH] ❌ Failed to send verification email:`, error.message);
        // Don't throw - let the user sign up even if email fails
        // They can request a new verification email later
      }
    },
  },

  emailAndPassword: {
    enabled: true,
    /**
     * Require verified email before sign-in (optional).
     * Keep false until you want to enforce verification.
     */
    requireEmailVerification: false,
    /**
     * Password reset email (Better Auth expects `sendResetPassword`).
     */
    sendResetPassword: async ({ user, url }) => {
      console.log(`[AUTH] Sending password reset email to: ${user.email}`);
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your Manthana Labs password",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Reset Password</h2>
              <p>Click to reset your password:</p>
              <a href="${url}" style="display: inline-block; background: #00c8b4; color: #000; 
                 padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Reset Password
              </a>
              <p style="color: #666; font-size: 12px;">Expires in 1 hour.</p>
            </div>
          `,
          text: `Reset your Manthana Labs password: ${url}\n\nExpires in 1 hour.`,
        });
        console.log(`[AUTH] ✅ Password reset email sent to: ${user.email}`);
      } catch (error: any) {
        console.error(`[AUTH] ❌ Failed to send password reset:`, error.message);
        throw error; // Let the user know password reset failed
      }
    },
  },

  plugins: [
    jwt({
      jwks: {
        rotationInterval: 60 * 60 * 24 * 30,
        gracePeriod: 60 * 60 * 24 * 30,
      },
    }),
  ],
});

console.log("[AUTH] Better Auth initialized successfully");
