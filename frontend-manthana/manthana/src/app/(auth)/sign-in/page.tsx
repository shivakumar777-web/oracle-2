"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: err } = await authClient.signIn.email(
      { email, password, callbackURL: "/" },
      {
        onSuccess: () => router.push("/"),
        onError: (ctx) => setError(ctx.error.message ?? "Sign in failed"),
      }
    );
    setLoading(false);
    if (err) setError(err.message ?? "Sign in failed");
    else if (data) router.push("/");
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-sm p-8 shadow-xl">
      <h1 className="font-ui text-lg tracking-[0.2em] uppercase text-gold-h mb-1">
        Sign in
      </h1>
      <p className="text-cream/50 text-sm mb-6">
        Access your MANTHANA account
      </p>

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
        <div>
          <label className="block font-ui text-[10px] tracking-[0.2em] uppercase text-cream/50 mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-cream/40 text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-gold-h hover:text-gold-p underline underline-offset-2">
          Sign up
        </Link>
      </p>
    </div>
  );
}
