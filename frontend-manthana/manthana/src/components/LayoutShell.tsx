"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import CosmicBackground from "./CosmicBackground";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { ErrorBoundary } from "./ErrorBoundary";
import { LangProvider, useLang } from "./LangProvider";
import { ToastProvider } from "@/hooks/useToast";
import ToastContainer from "./Toast";

// Lazy-load heavy overlays
const SettingsOverlay = dynamic(() => import("./SettingsOverlay"), { ssr: false });
const ChatHistory = dynamic(() => import("./ChatHistory"), { ssr: false });
const Onboarding = dynamic(() => import("./Onboarding"), { ssr: false });

type OverlayType = "settings" | "history" | null;

function useFirstVisit() {
  const [isFirst, setIsFirst] = useState<boolean | null>(null);
  useEffect(() => {
    const seen = localStorage.getItem("manthana_seen");
    setIsFirst(!seen);
  }, []);
  const markSeen = () => {
    localStorage.setItem("manthana_seen", "1");
    setIsFirst(false);
  };
  return { isFirst, markSeen };
}

function MobileLangBar() {
  const { lang, setLang } = useLang();
  return (
    <div className="md:hidden px-4 py-2 flex items-center gap-2 text-[11px] text-cream/70">
      <span className="text-[10px] uppercase tracking-[0.18em] text-cream/45">
        🗣️ AI Language
      </span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="ml-auto bg-black/40 border border-white/[0.18] rounded px-2 py-1 text-[11px] text-cream/80 focus:outline-none focus:border-teal-m"
      >
        <option value="en">English 🇮🇳</option>
        <option value="ta">தமிழ் 🇮🇳</option>
        <option value="hi">हिंदी 🇮🇳</option>
        <option value="te">తెలుగు 🇮🇳</option>
        <option value="kn">ಕನ್ನಡ 🇮🇳</option>
        <option value="ml">മലയാളം 🇮🇳</option>
      </select>
    </div>
  );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAnalyseRoute = pathname.startsWith("/analyse");
  const [expanded, setExpanded] = useState(false);
  const [overlay, setOverlay] = useState<OverlayType>(null);
  const { isFirst, markSeen } = useFirstVisit();
  const router = useRouter();

  const openOverlay = (key: string) => {
    if (key === "settings") setOverlay("settings");
    else if (key === "history") setOverlay("history");
  };

  const closeOverlay = () => setOverlay(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).openClinicalTools = (
      toolId: "drug" | "herb" | "trials" | "icd10",
      prefill?: any,
    ) => {
      const params = new URLSearchParams();
      if (toolId) params.set("tab", toolId);
      if (prefill?.drugs?.length) {
        params.set("drugs", prefill.drugs.join(","));
      }
      if (prefill?.herb) params.set("herb", prefill.herb);
      if (prefill?.drug) params.set("drug", prefill.drug);
      if (prefill?.query) params.set("query", prefill.query);
      const qs = params.toString();
      router.push(qs ? `/clinical-tools?${qs}` : "/clinical-tools");
    };
  }, [router]);

  if (isAnalyseRoute) {
    return (
      <LangProvider>
        <ToastProvider>
          <div className="relative min-h-screen overflow-x-hidden">
            <ErrorBoundary>{children}</ErrorBoundary>
            <ToastContainer />
          </div>
        </ToastProvider>
      </LangProvider>
    );
  }

  return (
    <LangProvider>
      <ToastProvider>
      <div className="relative min-h-screen bg-[#020610] overflow-x-hidden">
      {/* Cosmic background canvas */}
      <CosmicBackground />

      {/* Sidebar (desktop) */}
      <Sidebar
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onOverlayOpen={openOverlay}
      />

      {/* Main content area — shifts right on expanded sidebar */}
      <main
        className={`relative z-10 min-h-screen transition-all duration-300 ease-out
          md:ml-[60px] ${expanded ? "md:ml-[280px]" : ""}
          pb-14 md:pb-0`}
        id="main-content"
        style={{ isolation: "isolate", willChange: "transform" }}
      >
        {/* Disclaimer bar — top on desktop, always visible */}
        <div className="disclaimer-bar sticky top-0 z-30">
          ⚕ MANTHANA is for research and education only. Not a substitute for professional medical advice.
          Always consult a qualified healthcare provider before making clinical decisions.
        </div>

        {/* Mobile language selector (desktop uses sidebar) */}
        <MobileLangBar />

        {/* Page content */}
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav onOverlayOpen={openOverlay} />

      {/* Overlays */}
      {overlay === "settings" && <SettingsOverlay onClose={closeOverlay} />}
      {overlay === "history" && <ChatHistory onClose={closeOverlay} />}

      {/* Onboarding — first visit only */}
      {isFirst === true && <Onboarding onComplete={markSeen} />}

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
    </ToastProvider>
    </LangProvider>
  );
}
