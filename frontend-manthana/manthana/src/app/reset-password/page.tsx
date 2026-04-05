"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!token) {
      setError("Invalid or expired reset link");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authClient.resetPassword({
        newPassword: password,
        token,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Failed to reset password. Link may be expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020610] p-4">
        <div className="w-full max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-cream/70">Invalid or expired reset link.</p>
          <Link
            href="/forgot-password"
            className="text-gold-h hover:text-gold-p underline underline-offset-2 mt-4 inline-block"
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020610] p-4">
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-sm p-8 shadow-xl">
        <h1 className="font-ui text-lg tracking-[0.2em] uppercase text-gold-h mb-1">
          New Password
        </h1>
        <p className="text-cream/50 text-sm mb-6">
          Create a new password for your account
        </p>

        {success ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✓</div>
            <p className="text-cream/70 mb-4">Password reset successfully!</p>
            <Link
              href="/sign-in"
              className="text-gold-h hover:text-gold-p underline underline-offset-2"
            >
              Sign in with new password
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
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full rounded-lg px-4 py-2.5 bg-black/20 border border-white/[0.12] text-cream placeholder-cream/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
              />
            </div>

            <div>
              <label className="block font-ui text-[10px] tracking-[0.2em] uppercase text-cream/50 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg px-4 py-2.5 bg-black/20 border border-white/[0.12] text-cream placeholder-cream/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-ui text-sm tracking-[0.15em] uppercase bg-gold/20 border border-gold/40 text-gold-h hover:bg-gold/30 hover:border-gold/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Export with Suspense to handle useSearchParams
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#020610]">
        <div className="text-cream/50">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
