"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";
import { setOnboardingCookieClient } from "@/lib/auth/onboarding-cookie";
import GoogleSignInButton from "@/components/GoogleSignInButton";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const signInHref =
    callbackUrl != null && callbackUrl !== ""
      ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/sign-in";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { data, error: err } = await authClient.signUp.email({
      email,
      password,
      name: name.trim() || email.split("@")[0] || "User",
    });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Sign up failed");
      return;
    }
    if (data?.session) {
      setOnboardingCookieClient();
      router.refresh();
      router.push(safeInternalPath(callbackUrl, "/"));
      return;
    }
    setInfo(
      "Check your email for a confirmation link. After you confirm, sign in — your session will be remembered on this device."
    );
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-sm p-8 shadow-xl">
      <h1 className="font-ui text-lg tracking-[0.2em] uppercase text-gold-h mb-1">
        Sign up
      </h1>
      <p className="text-cream/50 text-sm mb-5">
        Use Google for instant access (no verification email), or register with email below.
      </p>

      <GoogleSignInButton callbackUrl={callbackUrl} />

      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-white/[0.1]" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 font-ui text-[9px] tracking-[0.25em] uppercase text-cream/30 bg-black/50">
            or email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-lg bg-teal/10 border border-teal/25 px-3 py-2 text-sm text-cream/80">
            {info}
          </div>
        )}
        <div>
          <label className="block font-ui text-[10px] tracking-[0.2em] uppercase text-cream/50 mb-1.5">
            Name <span className="text-cream/30">(or leave blank to use email)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Your name"
            className="w-full rounded-lg px-4 py-2.5 bg-black/20 border border-white/[0.12] text-cream placeholder-cream/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
          />
        </div>
        <div>
          <label className="block font-ui text-[10px] tracking-[0.2em] uppercase text-cream/50 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-lg px-4 py-2.5 bg-black/20 border border-white/[0.12] text-cream placeholder-cream/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
          />
        </div>
        <div>
          <label className="block font-ui text-[10px] tracking-[0.2em] uppercase text-cream/50 mb-1.5">
            Password <span className="text-cream/30">(min 8 chars)</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
            className="w-full rounded-lg px-4 py-2.5 bg-black/20 border border-white/[0.12] text-cream placeholder-cream/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg font-ui text-sm tracking-[0.15em] uppercase bg-gold/20 border border-gold/40 text-gold-h hover:bg-gold/30 hover:border-gold/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-center text-cream/40 text-sm">
        Already have an account?{" "}
        <Link href={signInHref} className="text-gold-h hover:text-gold-p underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-sm p-8 shadow-xl text-center text-cream/50 text-sm">
          Loading…
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
