"use client";

import { useEffect, useState } from "react";
import { useDeepResearch } from "@/hooks/useDeepResearch";
import { StepIndicator } from "@/components/deep-research/StepIndicator";
import { DomainSelector } from "@/components/deep-research/DomainSelector";
import { IntentSelector } from "@/components/deep-research/IntentSelector";
import { DepthControls } from "@/components/deep-research/DepthControls";
import { ResearchContextPill } from "@/components/deep-research/ResearchContextPill";
import { ResearchBar } from "@/components/deep-research/ResearchBar";
import { ResearchWorkspace } from "@/components/deep-research/ResearchWorkspace";
import { IntegrativeBadge } from "@/components/deep-research/IntegrativeBadge";
import { ResearchTemplates } from "@/components/deep-research/ResearchTemplates";
import { ResearchHistory } from "@/components/deep-research/ResearchHistory";
import { SavedThreadsPanel } from "@/components/deep-research/SavedThreadsPanel";
import { estimateResearchTime } from "@/lib/activity-log-simulator";
import { DEEP_RESEARCH_POSITIONING } from "@/lib/deep-research-positioning";
import Link from "next/link";

export default function DeepResearchPage() {
  const {
    state,
    toggleDomain,
    selectAllDomains,
    clearDomainSelection,
    toggleSubdomain,
    setIntent,
    updateDepth,
    // toggleSource removed - Universal Search auto-manages sources by domain
    setOutputFormat,
    setCitationStyle,
    setQuery,
    loadTemplate,
    runResearch,
    restoreResearchSession,
    reset,
    updateDepthSeconds,
    saveCurrentResultToServer,
    restoreFromServerThread,
  } = useDeepResearch();

  /** Matches backend integrative_mode / Universal Search cross-domain layer (2+ traditions). */
  const isIntegrative = state.selectedDomains.length >= 2;

  const estimatedTime = estimateResearchTime({
    domains: state.selectedDomains,
    depth: state.depth,
    intent: state.researchIntent || "clinical",
    targetSeconds: state.depthSeconds,
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runResearch();
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runResearch]);

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="deep-research-page">
      <div className="purple-ambient-overlay" aria-hidden="true" />

      <header className="deep-research-header">
        <div className="header-eyebrow">
          <span className="sanskrit-text">गहन अनुसन्धान</span>
          <span className="tradition-count">5 Medical Traditions</span>
        </div>
        <h1 className="deep-research-title">DEEP RESEARCH</h1>
        <p className="deep-research-positioning" role="doc-subtitle">
          {DEEP_RESEARCH_POSITIONING.headline}
        </p>
        <p className="deep-research-subtitle">Five oceans. One synthesis.</p>
        <p className="deep-research-not-oracle">
          {DEEP_RESEARCH_POSITIONING.notGeneralWebOracle}
        </p>
        <p className="deep-research-subtext">
          Structured intelligence across Allopathy · Ayurveda · Homeopathy ·
          Siddha · Unani
        </p>
      </header>

      <main className="deep-research-layout">
        <aside className="left-panel">
          <StepIndicator activeStep={state.activeStep} />

          <section className="step-section" data-step="1">
            <div className="step-header">
              <span className="step-number">①</span>
              <span className="step-label">Select Medical Domain(s)</span>
              <span className="step-hint">Any combination</span>
            </div>
            <p className="step-domain-intro">
              {DEEP_RESEARCH_POSITIONING.domainSelectionHint}
            </p>
            <p className="step-m5-crosslink">
              <Link href="/?mode=m5">M5 on the home page</Link>{" "}
              {DEEP_RESEARCH_POSITIONING.m5VersusDeepResearchShort}
            </p>
            <DomainSelector
              selectedDomains={state.selectedDomains}
              selectedSubdomains={state.selectedSubdomains}
              onToggleDomain={toggleDomain}
              onToggleSubdomain={toggleSubdomain}
              onSelectAll={selectAllDomains}
              onClearSelection={clearDomainSelection}
            />
            {isIntegrative && (
              <IntegrativeBadge domains={state.selectedDomains} />
            )}
          </section>

          <section
            className="step-section"
            data-step="2"
            data-active={state.activeStep >= 2}
          >
            <div className="step-header">
              <span className="step-number">②</span>
              <span className="step-label">Research Intent</span>
            </div>
            <IntentSelector
              selected={state.researchIntent}
              onSelect={setIntent}
            />
          </section>

          <section
            className="step-section"
            data-step="3"
            data-active={state.activeStep >= 3}
          >
            <div className="step-header">
              <span className="step-number">③</span>
              <span className="step-label">Depth & Sources</span>
            </div>
            <DepthControls
              depth={state.depth}
              depthSeconds={state.depthSeconds}
              outputFormat={state.outputFormat}
              citationStyle={state.citationStyle}
              selectedDomains={state.selectedDomains}
              onDepthChange={updateDepth}
              onDepthSecondsChange={updateDepthSeconds}
              onFormatChange={setOutputFormat}
              onCitationStyleChange={setCitationStyle}
            />
          </section>

          <ResearchTemplates onLoad={loadTemplate} />
          <ResearchHistory onRestoreSession={restoreResearchSession} />
          <SavedThreadsPanel onRestoreThread={restoreFromServerThread} />
        </aside>

        <section className="right-panel">
          <div className="right-panel-inner">
            <div className="search-section-desktop">
              <ResearchContextPill
                domains={state.selectedDomains}
                subdomains={state.selectedSubdomains}
                intent={state.researchIntent}
                depth={state.depth}
              />
              <ResearchBar
                query={state.query}
                onChange={setQuery}
                onSubmit={runResearch}
                isLoading={state.isResearching}
                disabled={state.isResearching}
                onOpenSettings={() => setSettingsOpen(true)}
              />
              <div className="cta-footer">
                <span className="estimated-time">
                  {state.selectedDomains.length > 0
                    ? `⏱ Estimated: ~${estimatedTime}s`
                    : "Tip: select domains and intent for best results"}
                </span>
                <div className="cta-footer-right">
                  <span className="shortcut-hint">Ctrl+Enter</span>
                </div>
              </div>
            </div>
            <div className="workspace-shell">
              <ResearchWorkspace
                state={state}
                onReset={reset}
                onSaveToServer={saveCurrentResultToServer}
              />
            </div>
          </div>
        </section>
      </main>

      {settingsOpen && (
        <div
          className="dr-settings-backdrop"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="dr-settings-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dr-settings-header">
              <div>
                <div className="dr-settings-title">
                  Deep Research Engine
                </div>
                <div className="dr-settings-subtitle">
                  {DEEP_RESEARCH_POSITIONING.enginePurpose}
                </div>
              </div>
              <button
                className="dr-settings-close"
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>
            <div className="dr-settings-body">
              <DepthControls
                depth={state.depth}
                depthSeconds={state.depthSeconds}
                outputFormat={state.outputFormat}
                citationStyle={state.citationStyle}
                selectedDomains={state.selectedDomains}
                onDepthChange={updateDepth}
                onDepthSecondsChange={updateDepthSeconds}
                onFormatChange={setOutputFormat}
                onCitationStyleChange={setCitationStyle}
              />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .deep-research-page {
          min-height: 100vh;
          background: #05040f;
          position: relative;
          font-family: "Lora", Georgia, serif;
          color: #f5efe8;
          overflow-x: hidden;
        }
        .purple-ambient-overlay {
          position: fixed;
          inset: 0;
          background:
            radial-gradient(
              ellipse at 65% 25%,
              rgba(109, 40, 217, 0.12) 0%,
              transparent 60%
            ),
            radial-gradient(
              ellipse at 20% 80%,
              rgba(124, 58, 237, 0.06) 0%,
              transparent 50%
            );
          pointer-events: none;
          z-index: 0;
        }
        .deep-research-header {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 3rem 2rem 2rem;
          border-bottom: 1px solid rgba(124, 58, 237, 0.2);
        }
        .header-eyebrow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .sanskrit-text {
          font-family: "Lora", serif;
          font-size: 0.85rem;
          color: rgba(200, 146, 42, 0.7);
          letter-spacing: 0.15em;
        }
        .tradition-count {
          font-family: "Space Mono", monospace;
          font-size: 0.7rem;
          color: rgba(124, 58, 237, 0.6);
          letter-spacing: 0.2em;
          text-transform: uppercase;
          border: 1px solid rgba(124, 58, 237, 0.3);
          padding: 0.2em 0.7em;
          border-radius: 999px;
        }
        .deep-research-title {
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          font-weight: 800;
          letter-spacing: 0.25em;
          background: linear-gradient(
            135deg,
            #f0c060 0%,
            #f5efe8 40%,
            #c8922a 70%,
            #f0c060 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-transform: uppercase;
          margin-bottom: 0.4rem;
        }
        .deep-research-positioning {
          font-family: "Lora", serif;
          font-size: clamp(0.9rem, 2vw, 1.05rem);
          color: rgba(245, 239, 232, 0.88);
          line-height: 1.45;
          max-width: 36rem;
          margin: 0 auto 0.65rem;
          font-weight: 500;
        }
        .deep-research-subtitle {
          font-family: "Space Mono", monospace;
          font-size: 0.7rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(245, 239, 232, 0.5);
          margin-bottom: 0.4rem;
        }
        .deep-research-not-oracle {
          font-family: "Space Mono", monospace;
          font-size: 0.62rem;
          letter-spacing: 0.06em;
          color: rgba(167, 243, 208, 0.75);
          max-width: 34rem;
          margin: 0 auto 0.65rem;
          line-height: 1.5;
        }
        .deep-research-subtext {
          font-family: "Lora", serif;
          font-size: 0.8rem;
          color: rgba(245, 239, 232, 0.6);
        }
        .deep-research-layout {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
          gap: 1.5rem;
          padding: 1.5rem 1.75rem 2.5rem;
        }
        .left-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          border-right: 1px solid rgba(124, 58, 237, 0.16);
          padding-right: 1.25rem;
        }
        .right-panel {
          min-height: 480px;
          padding-left: 0.5rem;
          display: flex;
          flex-direction: column;
        }
        .right-panel-inner {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 100%;
        }
        .workspace-shell {
          flex: 1;
          min-height: 360px;
        }
        .step-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .step-header {
          display: flex;
          align-items: baseline;
          gap: 0.4rem;
        }
        .step-number {
          font-family: "Space Mono", monospace;
          font-size: 0.7rem;
          color: rgba(200, 146, 42, 0.85);
        }
        .step-label {
          font-family: "Space Mono", monospace;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: rgba(245, 239, 232, 0.8);
        }
        .step-hint {
          margin-left: auto;
          font-family: "Space Mono", monospace;
          font-size: 0.55rem;
          color: rgba(245, 239, 232, 0.4);
        }
        .step-domain-intro {
          margin: 0 0 0.35rem;
          font-size: 0.72rem;
          line-height: 1.45;
          color: rgba(245, 239, 232, 0.72);
        }
        .step-m5-crosslink {
          margin: 0 0 0.65rem;
          font-size: 0.65rem;
          line-height: 1.4;
          color: rgba(196, 181, 253, 0.75);
        }
        .step-m5-crosslink a {
          color: rgba(196, 181, 253, 0.95);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .step-m5-crosslink a:hover {
          color: rgba(221, 214, 254, 1);
        }
        .search-section-desktop {
          margin-bottom: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .cta-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: "Space Mono", monospace;
          font-size: 0.55rem;
          color: rgba(245, 239, 232, 0.4);
        }
        .cta-footer-right {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .shortcut-hint {
          padding: 0.2em 0.5em;
          border-radius: 4px;
          border: 1px solid rgba(245, 239, 232, 0.18);
        }
        @media (max-width: 768px) {
          .deep-research-layout {
            grid-template-columns: 1fr;
          }
          .left-panel {
            border-right: none;
            border-bottom: 1px solid rgba(124, 58, 237, 0.15);
            padding-right: 0;
            padding-bottom: 1rem;
          }
          .right-panel {
            padding-left: 0;
          }
        }
        .dr-settings-backdrop {
          position: fixed;
          inset: 0;
          background: radial-gradient(
              circle at 0 0,
              rgba(15, 23, 42, 0.8),
              rgba(15, 23, 42, 0.95)
            );
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          display: flex;
          justify-content: flex-end;
          z-index: 40;
        }
        .dr-settings-panel {
          width: min(420px, 100%);
          height: 100%;
          background: rgba(5, 4, 15, 0.96);
          border-left: 1px solid rgba(124, 58, 237, 0.4);
          box-shadow: -24px 0 60px rgba(15, 23, 42, 0.9);
          padding: 1.5rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .dr-settings-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }
        .dr-settings-title {
          font-family: "Space Mono", monospace;
          font-size: 0.8rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #f5efe8;
        }
        .dr-settings-subtitle {
          font-family: "Lora", serif;
          font-size: 0.75rem;
          color: rgba(245, 239, 232, 0.55);
          margin-top: 0.3rem;
        }
        .dr-settings-close {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          background: transparent;
          color: rgba(226, 232, 240, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 0.7rem;
          transition: all 0.2s ease;
        }
        .dr-settings-close:hover {
          border-color: rgba(200, 146, 42, 0.9);
          color: #fbbf24;
        }
        .dr-settings-body {
          flex: 1;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}

