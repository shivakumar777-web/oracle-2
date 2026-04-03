"use client";

import React from "react";
import { RESEARCH_DOMAINS } from "@/lib/deep-research-config";

const AyurvedaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
    <path d="M8 20h8M12 20v-4M7 16s-3-2-3-6c0-3 2-5 4-5h8c2 0 4 2 4 5 0 4-3 6-3 6H7z" />
    <path d="M9 5c0-1.5 1.5-3 3-3s3 1.5 3 3" />
    <path d="M10 9c1-1 3-1 4 0" />
  </svg>
);

const HomeopathyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
    <ellipse cx="12" cy="8" rx="6" ry="3" />
    <path d="M6 8c0 4 2 7 6 7s6-3 6-7" />
    <path d="M15 5l3-3" />
    <path d="M8 20h8" />
  </svg>
);

const SiddhaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
    <path d="M2 12h3l2-5 3 10 2-7 2 4 2-2h6" />
  </svg>
);

const AllopathyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M12 7c3-2 6 0 6 3s-3 4-6 4" />
    <path d="M9 21h6" />
  </svg>
);

const UnaniIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M12 6c2-1 4 0 4 2s-2 3-4 3" />
    <path d="M12 11c2-1 4 0 4 2s-2 3-4 3" />
    <path d="M12 16c2-1 4 0 4 2" />
  </svg>
);
import { SubdomainGrid } from "./SubdomainGrid";

interface Props {
  selectedDomains: string[];
  selectedSubdomains: Record<string, string[]>;
  onToggleDomain: (id: string) => void;
  onToggleSubdomain: (domainId: string, subId: string) => void;
  /** Optional: quick-select all five traditions (integrative). */
  onSelectAll?: () => void;
  /** Optional: clear all domain + subdomain picks. */
  onClearSelection?: () => void;
}

export function DomainSelector({
  selectedDomains,
  selectedSubdomains,
  onToggleDomain,
  onToggleSubdomain,
  onSelectAll,
  onClearSelection,
}: Props) {
  const n = RESEARCH_DOMAINS.length;
  const allSelected = selectedDomains.length === n;

  return (
    <div className="domain-selector">
      {(onSelectAll || onClearSelection) && (
        <div className="domain-quick-actions" role="group" aria-label="Domain selection shortcuts">
          {onSelectAll && (
            <button
              type="button"
              className="quick-action-btn"
              onClick={onSelectAll}
              disabled={allSelected}
              title="Select all five medical traditions"
            >
              All five ({n})
            </button>
          )}
          {onClearSelection && (
            <button
              type="button"
              className="quick-action-btn ghost"
              onClick={onClearSelection}
              disabled={selectedDomains.length === 0}
            >
              Clear
            </button>
          )}
        </div>
      )}
      <div className="domain-grid">
        {RESEARCH_DOMAINS.map((domain) => {
          const isSelected = selectedDomains.includes(domain.id);
          const selectedSubs = selectedSubdomains[domain.id] || [];
          return (
            <div key={domain.id} className="domain-card-wrapper">
              <button
                className={`domain-card ${isSelected ? "selected" : ""}`}
                onClick={() => onToggleDomain(domain.id)}
                style={
                  {
                    "--domain-color": domain.color,
                    "--domain-glow": domain.glowColor,
                  } as React.CSSProperties
                }
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span className="check-badge" aria-label="Selected">
                    ✓
                  </span>
                )}

                <div className="domain-symbol" style={{ color: domain.color }}>
                  {domain.id === "allopathy" && <AllopathyIcon />}
                  {domain.id === "ayurveda" && <AyurvedaIcon />}
                  {domain.id === "homeopathy" && <HomeopathyIcon />}
                  {domain.id === "siddha" && <SiddhaIcon />}
                  {domain.id === "unani" && <UnaniIcon />}
                </div>

                <div className="domain-info">
                  <div className="domain-label">{domain.label}</div>
                  <div className="domain-subtitle">{domain.subtitle}</div>
                  {(domain.sanskritName ||
                    domain.tamilName ||
                    domain.arabicName) && (
                    <div className="domain-native">
                      {domain.sanskritName ||
                        domain.tamilName ||
                        domain.arabicName}
                    </div>
                  )}
                </div>

                {isSelected && selectedSubs.length > 0 && (
                  <span
                    className="subdomain-count-badge"
                    style={{ background: domain.color }}
                  >
                    {selectedSubs.length} topic
                    {selectedSubs.length > 1 ? "s" : ""}
                  </span>
                )}
              </button>

              {isSelected && (
                <div className="subdomain-panel">
                  <SubdomainGrid
                    domain={domain}
                    selectedSubdomains={selectedSubs}
                    onToggle={(subId) => onToggleSubdomain(domain.id, subId)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .domain-quick-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.65rem;
        }
        .quick-action-btn {
          font-size: 0.75rem;
          padding: 0.35rem 0.65rem;
          border-radius: 8px;
          border: 1px solid rgba(200, 180, 160, 0.35);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(245, 240, 232, 0.92);
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .quick-action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(200, 180, 160, 0.55);
        }
        .quick-action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .quick-action-btn.ghost {
          background: transparent;
        }
        .domain-grid {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .domain-card {
          width: 100%;
          display: grid;
          grid-template-columns: 2.5rem 1fr auto;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(245, 240, 232, 0.07);
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          position: relative;
          transition: all 0.25s ease;
          overflow: hidden;
        }
        .domain-card::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.3s ease;
          background: var(--domain-glow);
        }
        .domain-card:hover::before {
          opacity: 0.5;
        }
        .domain-card:hover {
          border-color: color-mix(
            in srgb,
            var(--domain-color) 30%,
            transparent
          );
          transform: translateX(2px);
        }
        .domain-card.selected {
          border-color: var(--domain-color);
          box-shadow: 0 0 20px var(--domain-glow),
            inset 0 0 20px var(--domain-glow);
        }
        .domain-card.selected::before {
          opacity: 1;
        }
        .check-badge {
          position: absolute;
          top: 0.5rem;
          right: 0.6rem;
          width: 1.15rem;
          height: 1.15rem;
          border-radius: 999px;
          border: 1px solid rgba(245, 239, 232, 0.4);
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          color: #f0c060;
        }
        .domain-symbol {
          font-size: 1.6rem;
        }
        .domain-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .domain-label {
          font-family: "Space Mono", monospace;
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #f5efe8;
        }
        .domain-subtitle {
          font-family: "Lora", serif;
          font-size: 0.7rem;
          color: rgba(245, 239, 232, 0.5);
        }
        .domain-native {
          font-family: "Cormorant Garamond", serif;
          font-size: 0.75rem;
          color: rgba(200, 146, 42, 0.8);
        }
        .subdomain-count-badge {
          font-family: "Space Mono", monospace;
          font-size: 0.55rem;
          padding: 0.2em 0.55em;
          border-radius: 999px;
          color: #020208;
        }
        .subdomain-panel {
          margin-top: 0.45rem;
          padding-left: 0.75rem;
          border-left: 1px dashed rgba(245, 240, 232, 0.12);
        }
      `}</style>
    </div>
  );
}

