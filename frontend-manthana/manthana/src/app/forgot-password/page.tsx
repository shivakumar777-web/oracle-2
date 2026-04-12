"use client";

import React, { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { browserOAuthOrigin } from "@/lib/auth/site-public-origin";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await authClient.resetPasswordForEmail(email, {
        redirectTo: `${browserOAuthOrigin()}/reset-password`,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send reset email. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020610] p-4">
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-sm p-8 shadow-xl">
        <h1 className="font-ui text-lg tracking-[0.2em] uppercase text-gold-h mb-1">
          Reset Password
        </h1>
        <p className="text-cream/50 text-sm mb-6">
          Enter your email to receive a reset link
        </p>

        {submitted ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✉️</div>
            <p className="text-cream/70 mb-4">
              Check your email for a reset link. It expires in 1 hour.
            </p>
            <Link
              href="/sign-in"
              className="text-gold-h hover:text-gold-p underline underline-offset-2"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className="block font-ui text-[10px] tracking-[0.2em] uppercase text-cream/50 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg px-4 py-2.5 bg-black/20 border border-white/[0.12] text-cream placeholder-cream/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-ui text-sm tracking-[0.15em] uppercase bg-gold/20 border border-gold/40 text-gold-h hover:bg-gold/30 hover:border-gold/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-cream/40 text-sm">
          Remember your password?{" "}
          <Link
            href="/sign-in"
            className="text-gold-h hover:text-gold-p underline underline-offset-2"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
