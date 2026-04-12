"use client";

import { useState } from "react";
import DOMPurify from "dompurify";
import type { DeepResearchResult } from "@/hooks/useDeepResearch";
import type { CitationStyle } from "@/lib/deep-research-config";
import {
  citationStyleLabel,
  formatReferencesList,
  getSourceBadges,
  normalizeCitationFormatKey,
} from "@/lib/citation-format";
import { RESEARCH_DOMAINS } from "@/lib/deep-research-config";

const AllopathyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" width="14" height="14">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M12 7c3-2 6 0 6 3s-3 4-6 4" />
    <path d="M9 21h6" />
  </svg>
);

const AyurvedaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" width="14" height="14">
    <path d="M8 20h8M12 20v-4M7 16s-3-2-3-6c0-3 2-5 4-5h8c2 0 4 2 4 5 0 4-3 6-3 6H7z" />
    <path d="M9 5c0-1.5 1.5-3 3-3s3 1.5 3 3" />
    <path d="M10 9c1-1 3-1 4 0" />
  </svg>
);

const HomeopathyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" width="14" height="14">
    <ellipse cx="12" cy="8" rx="6" ry="3" />
    <path d="M6 8c0 4 2 7 6 7s6-3 6-7" />
    <path d="M15 5l3-3" />
    <path d="M8 20h8" />
  </svg>
);

const SiddhaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" width="14" height="14">
    <path d="M2 12h3l2-5 3 10 2-7 2 4 2-2h6" />
  </svg>
);

const UnaniIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" width="14" height="14">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M12 6c2-1 4 0 4 2s-2 3-4 3" />
    <path d="M12 11c2-1 4 0 4 2s-2 3-4 3" />
    <path d="M12 16c2-1 4 0 4 2" />
  </svg>
);

interface Props {
  result: DeepResearchResult;
  onReset: () => void;
  /** Wizard selection (fallback if API omits citation_style on result). */
  citationStyle?: CitationStyle;
  /** Persist to research-service when user is authenticated. */
  onSaveToServer?: () => Promise<void>;
}

const SECTION_ICONS: Record<string, string> = {
  "Research Summary": "📋",
  "Key Findings": "🔑",
  "Clinical Evidence": "🏥",
  "Traditional Correlation": "🌿",
  "Pharmacological Analysis": "💊",
  "Integrative Synthesis": "⚖️",
  "Research Gaps": "🔭",
  "Citations & References": "📚",
  // Thesis / dissertation
  Abstract: "📄",
  Introduction: "🧭",
  "Review of Literature": "📚",
  Discussion: "💬",
  Conclusion: "✓",
  // PRISMA / systematic review
  Background: "🌐",
  "Methods (PRISMA)": "📐",
  Results: "📈",
  "Quality Assessment": "⭐",
  "Evidence Synthesis": "🔗",
  "Gaps & Limitations": "🔭",
  // CARE / case report
  "Patient Information": "👤",
  "Clinical Findings": "🩺",
  "Diagnostic Assessment": "🔬",
  "Therapeutic Intervention": "💉",
  "Follow-up": "📅",
};

function formatContent(
  content: string,
  citations: DeepResearchResult["citations"],
): string {
  if (!citations || citations.length === 0) return content;
  return content.replace(/\[(\d+)\]/g, (match, idxStr) => {
    const idx = Number(idxStr);
    if (!Number.isFinite(idx) || idx < 1 || idx > citations.length) {
      return match;
    }
    return `<sup>[${idx}]</sup>`;
  });
}

export function WorkspaceResultState({
  result,
  onReset,
  citationStyle,
  onSaveToServer,
}: Props) {
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const effectiveFormat = normalizeCitationFormatKey(
    result.citation_style ?? citationStyle,
  );
  const styleLabel = citationStyleLabel(effectiveFormat);
  const handleExportPDF = () => {
    window.print();
  };

  const handleCopy = async () => {
    const text = result.sections
      .map((s) => `## ${s.title}\n\n${s.content}`)
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
  };

  const handleCopyReferences = async () => {
    const text = formatReferencesList(result.citations ?? [], effectiveFormat);
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
  };

  const handleSaveToServer = async () => {
    if (!onSaveToServer) return;
    setSaveState("saving");
    try {
      await onSaveToServer();
      setSaveState("saved");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("deep-research-threads-updated"));
      }
      setTimeout(() => setSaveState("idle"), 4000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 5000);
    }
  };

  return (
    <div className="result-state">
      <div className="research-disclaimer" role="note">
        <p>
          This output is for research and educational purposes only. It does not
          constitute medical advice, diagnosis, or treatment. Always consult a
          qualified healthcare professional.
        </p>
      </div>
      <div className="result-meta">
        <div className="result-stats">
          <div className="stat">
            <span className="stat-value">
              {result.sources_searched}
            </span>
            <span className="stat-label">Sources</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">
              {result.citations?.length || 0}
            </span>
            <span className="stat-label">Citations</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">
              {result.time_taken_seconds}s
            </span>
            <span className="stat-label">Research Time</span>
          </div>
          <div className="stat-divider" />
          <div className="stat style-chip-stat" title="Citation style for this run">
            <span className="stat-value style-chip">{styleLabel}</span>
            <span className="stat-label">Cite style</span>
          </div>
          <div className="stat-divider" />
          <div className="stat domains-consulted">
            {result.domains_consulted?.map((d) => {
              const domain = RESEARCH_DOMAINS.find((rd) => rd.id === d);
              if (!domain) return null;
              return (
                <span
                  key={d}
                  style={{ color: domain.color }}
                  title={domain.label}
                >
                  {domain.id === "allopathy" && <AllopathyIcon />}
                  {domain.id === "ayurveda" && <AyurvedaIcon />}
                  {domain.id === "homeopathy" && <HomeopathyIcon />}
                  {domain.id === "siddha" && <SiddhaIcon />}
                  {domain.id === "unani" && <UnaniIcon />}
                </span>
              );
            })}
          </div>
        </div>

        <div className="result-actions">
          <button
            className="action-btn"
            onClick={handleExportPDF}
            title="Export as PDF"
          >
            📄 PDF
          </button>
          <button
            className="action-btn"
            onClick={handleCopy}
            title="Copy all text"
          >
            📋 Copy
          </button>
          <button
            className="action-btn"
            onClick={handleCopyReferences}
            disabled={!result.citations?.length}
            title={`Copy numbered references (${styleLabel})`}
          >
            📎 Refs
          </button>
          {onSaveToServer && (
            <button
              type="button"
              className={`action-btn save-cloud ${saveState}`}
              onClick={handleSaveToServer}
              disabled={saveState === "saving"}
              title="Save this research to your account (requires sign-in)"
            >
              {saveState === "idle" && "☁ Save"}
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "✓ Saved"}
              {saveState === "error" && "⚠ Retry"}
            </button>
          )}
          <button
            className="action-btn"
            onClick={() => {
              if (typeof window !== "undefined") {
                (window as any).openClinicalTools?.("trials", {
                  query: (result as any).query ?? "",
                });
              }
            }}
            title="Find related clinical trials"
          >
            🧬 Find Trials
          </button>
          <button
            className="action-btn"
            onClick={onReset}
            title="New research"
          >
            ↺ New
          </button>
        </div>
      </div>

      {result.integrative_mode && (
        <div className="integrative-result-badge">
          ✦ Integrative Research — Multi-tradition synthesis complete
        </div>
      )}

      <div className="result-sections">
        {result.sections?.map((section, idx) => (
          <div key={section.id || idx} className="result-section">
            <div className="section-divider">
              <span className="section-icon">
                {SECTION_ICONS[section.title] || "◆"}
              </span>
              <span className="section-title">
                {section.title.toUpperCase()}
              </span>
              <div className="divider-line" />
            </div>
            <div
              className="section-content"
              dangerouslySetInnerHTML={{
                __html:
                  typeof DOMPurify !== "undefined" && DOMPurify.sanitize
                    ? DOMPurify.sanitize(formatContent(section.content, result.citations), {
                        ALLOWED_TAGS: ["sup", "a", "strong", "em", "p", "br", "ul", "ol", "li"],
                        ALLOWED_ATTR: ["href", "target", "rel"],
                      })
                    : formatContent(section.content, result.citations),
              }}
            />
          </div>
        ))}
      </div>

      {result.citations && result.citations.length > 0 && (
        <div className="citations-section">
          <div className="section-divider">
            <span className="section-icon">📚</span>
            <span className="section-title">REFERENCES</span>
            <div className="divider-line" />
          </div>
          <ol className="citations-list">
            {result.citations.map((citation, idx) => (
              <li key={citation.id || idx} className="citation-item">
                <span className="citation-number">[{idx + 1}]</span>
                <span className="citation-badges" aria-hidden="true">
                  {getSourceBadges(citation).map((b) => (
                    <span key={b.key} className="citation-badge">
                      {b.label}
                    </span>
                  ))}
                </span>
                <span className="citation-text">
                  {citation.authors}. {citation.title}.{" "}
                  {citation.journal != null && (
                    <>
                      <em>{citation.journal}</em>.{" "}
                    </>
                  )}
                  {citation.year != null && `${citation.year}.`}
                  {citation.doi && (
                    <a
                      href={`https://doi.org/${citation.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="citation-link"
                    >
                      DOI: {citation.doi}
                    </a>
                  )}
                  {citation.pmid && (
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${citation.pmid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="citation-link"
                    >
                      PMID: {citation.pmid}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {Array.isArray(result.followup_questions) &&
        result.followup_questions!.filter(Boolean).length > 0 && (
          <div className="followup-section">
            <div className="section-divider">
              <span className="section-icon">❓</span>
              <span className="section-title">FOLLOW-UP QUESTIONS</span>
              <div className="divider-line" />
            </div>
            <ul className="followup-list">
              {result.followup_questions!
                .filter((q) => q && q.trim())
                .map((q, i) => (
                  <li key={i} className="followup-item">
                    {q}
                  </li>
                ))}
            </ul>
          </div>
        )}

      {result.provider_used ? (
        <div className="provider-footer" aria-live="polite">
          Synthesized with: {result.provider_used}
        </div>
      ) : null}

      <style jsx>{`
        .result-state {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .research-disclaimer {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border: 1px solid rgba(245, 158, 11, 0.35);
          background: rgba(245, 158, 11, 0.08);
          color: rgba(253, 230, 138, 0.92);
          font-family: "Lora", serif;
          font-size: 0.82rem;
          line-height: 1.5;
        }
        .research-disclaimer p {
          margin: 0;
        }
        .provider-footer {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.65rem;
          color: rgba(245, 239, 232, 0.45);
          text-align: right;
          padding: 0 0.25rem;
        }
        .result-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: rgba(124, 58, 237, 0.06);
          border: 1px solid rgba(124, 58, 237, 0.2);
          border-radius: 10px;
        }
        .result-stats {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
        }
        .stat-value {
          font-family: "Space Mono", monospace;
          font-size: 1rem;
          font-weight: 700;
          color: #f5efe8;
        }
        .stat-label {
          font-family: "Space Mono", monospace;
          font-size: 0.55rem;
          color: rgba(245, 239, 232, 0.35);
          text-transform: uppercase;
        }
        .stat-divider {
          width: 1px;
          height: 30px;
          background: rgba(245, 239, 232, 0.1);
        }
        .domains-consulted {
          display: flex;
          gap: 0.4rem;
          font-size: 1.1rem;
        }
        .result-actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .action-btn {
          font-family: "Space Mono", monospace;
          font-size: 0.62rem;
          padding: 0.4em 0.8em;
          border: 1px solid rgba(245, 240, 232, 0.1);
          background: rgba(255, 255, 255, 0.02);
          color: rgba(245, 239, 232, 0.65);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          border-color: rgba(124, 58, 237, 0.4);
          color: #f5efe8;
        }
        .integrative-result-badge {
          font-family: "Cormorant Garamond", serif;
          font-size: 0.9rem;
          font-style: italic;
          color: #f0c060;
          text-align: center;
          padding: 0.6rem;
          border: 1px solid rgba(240, 192, 96, 0.2);
          border-radius: 8px;
          background: rgba(240, 192, 96, 0.04);
          animation: goldShimmer 3s linear infinite;
          background-size: 200% auto;
        }
        @keyframes goldShimmer {
          0% {
            background-position: 0% center;
          }
          100% {
            background-position: 200% center;
          }
        }
        .result-sections {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .result-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .section-divider {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .section-icon {
          font-size: 0.9rem;
        }
        .section-title {
          font-family: "Space Mono", monospace;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: rgba(240, 192, 96, 0.95);
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(
            to right,
            rgba(240, 192, 96, 0.6),
            rgba(240, 192, 96, 0.05)
          );
        }
        .section-content {
          font-family: "Lora", serif;
          font-size: 0.85rem;
          color: rgba(245, 239, 232, 0.88);
          line-height: 1.7;
        }
        .section-content sup {
          font-size: 0.65em;
          vertical-align: super;
        }
        .citations-section {
          margin-top: 0.75rem;
        }
        .citations-list {
          margin: 0.5rem 0 0;
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .citation-item {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.35rem 0.5rem;
          font-family: "JetBrains Mono", "Space Mono", monospace;
          font-size: 0.68rem;
          color: rgba(245, 239, 232, 0.8);
        }
        .citation-badges {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }
        .citation-badge {
          font-size: 0.52rem;
          font-family: "Space Mono", monospace;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.12rem 0.38rem;
          border-radius: 4px;
          background: rgba(129, 140, 248, 0.12);
          border: 1px solid rgba(165, 180, 252, 0.35);
          color: rgba(199, 210, 254, 0.92);
        }
        .style-chip-stat .style-chip {
          font-size: 0.72rem !important;
          color: rgba(240, 192, 96, 0.95) !important;
          font-weight: 600;
        }
        .action-btn.save-cloud.saving {
          opacity: 0.75;
          cursor: wait;
        }
        .action-btn.save-cloud.saved {
          border-color: rgba(34, 197, 94, 0.75);
          color: rgba(187, 247, 208, 0.95);
        }
        .action-btn.save-cloud.error {
          border-color: rgba(248, 113, 113, 0.75);
        }
        .followup-section {
          margin-top: 0.5rem;
        }
        .followup-list {
          margin: 0.4rem 0 0;
          padding-left: 1.25rem;
        }
        .followup-item {
          font-family: "Lora", serif;
          font-size: 0.85rem;
          color: rgba(245, 239, 232, 0.88);
          line-height: 1.55;
          margin-bottom: 0.35rem;
        }
        @media (max-width: 640px) {
          .result-meta {
            flex-direction: column;
            align-items: stretch;
          }
          .result-stats {
            flex-wrap: wrap;
            justify-content: center;
          }
          .result-actions {
            justify-content: flex-start;
          }
          .action-btn {
            min-height: 44px;
            padding: 0.45rem 0.7rem;
          }
        }
        .citation-number {
          margin-right: 0.35rem;
        }
        .citation-link {
          margin-left: 0.35rem;
          color: #a5b4fc;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

