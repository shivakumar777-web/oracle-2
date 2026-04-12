"use client";

import React, { useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { setOnboardingCookieClient } from "@/lib/auth/onboarding-cookie";

const Onboarding = dynamic(() => import("@/components/Onboarding"), {
  ssr: false,
});

export default function WelcomePage() {
  const router = useRouter();

  const finishIntro = useCallback(() => {
    setOnboardingCookieClient();
    try {
      localStorage.setItem("manthana_seen", "1");
    } catch {
      /* ignore */
    }
    router.replace("/sign-in?callbackUrl=/");
  }, [router]);

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center p-6">
      <p className="absolute top-6 left-0 right-0 text-center font-ui text-[10px] tracking-[0.35em] uppercase text-cream/30 pointer-events-none">
        Intro — then sign in to open Oracle
      </p>
      <Onboarding onComplete={finishIntro} />
    </div>
  );
}
