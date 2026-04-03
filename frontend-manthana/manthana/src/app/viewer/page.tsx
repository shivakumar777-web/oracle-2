"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ViewerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("url") ?? "";

  const parsed = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u;
    } catch {
      return null;
    }
  }, [raw]);

  const target = parsed?.toString() ?? "";

  if (!parsed || !target) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#020618] px-4 text-center">
        <p className="font-ui text-sm text-cream/60">Missing or invalid link.</p>
        <Link href="/search" className="mt-4 text-gold-h underline text-sm">
          Back to search
        </Link>
      </div>
    );
  }

  const host = parsed.hostname;

  return (
    <div className="flex h-[100dvh] flex-col bg-[#020618]">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-white/[0.08] px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px] font-ui text-cream/70 hover:bg-white/[0.06]"
        >
          ← Back
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-ui text-[10px] uppercase tracking-wider text-cream/35">Viewing</p>
          <p className="truncate font-mono text-[11px] text-cream/80" title={target}>
            {host}
          </p>
        </div>
        <a
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 rounded-lg border border-gold/30 px-2 py-1.5 text-[10px] font-ui text-gold-h hover:bg-gold/10"
        >
          Open in browser
        </a>
        <Link
          href="/search"
          className="hidden sm:inline rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-cream/50 hover:text-cream/80"
        >
          Search
        </Link>
      </header>

      <div className="relative min-h-0 flex-1 bg-[#0a1628]">
        {/* No sandbox: many medical sites require full JS; user chose this URL from our results */}
        <iframe
          title={`Content from ${host}`}
          src={target}
          className="h-full w-full border-0"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <p className="pointer-events-none absolute bottom-2 left-2 right-2 rounded bg-black/50 px-2 py-1 text-center text-[9px] text-cream/45 sm:text-[10px]">
          Some sites block embedded viewing — use &quot;Open in browser&quot; if the page stays blank.
        </p>
      </div>
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#020618] text-cream/50 text-sm">
          Loading viewer…
        </div>
      }
    >
      <ViewerInner />
    </Suspense>
  );
}
