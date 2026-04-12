"use client";

import Link from "next/link";

export default function MedtracePage() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-5 text-4xl text-gold-h/85" aria-hidden>
        ⬡
      </span>
      <h1 className="font-ui text-2xl tracking-[0.22em] uppercase text-shimmer md:text-3xl">
        Medtrace
      </h1>
      <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-cream/45 italic">
        Trace clinical provenance and evidence paths — workspace coming soon.
      </p>
      <Link
        href="/"
        className="mt-10 font-ui text-xs tracking-[0.14em] uppercase text-gold-h/80 underline-offset-4 hover:text-gold-h"
      >
        ← Oracle
      </Link>
    </div>
  );
}
