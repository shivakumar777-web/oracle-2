"use client";

import { useState } from "react";
import type { ResearchDomain } from "@/lib/deep-research-config";

interface Props {
  domain: ResearchDomain;
  selectedSubdomains: string[];
  onToggle: (id: string) => void;
}

export function SubdomainGrid({
  domain,
  selectedSubdomains,
  onToggle,
}: Props) {
  const [showAll] = useState(false); // reserved for future expansion
  const categories = Array.from(new Set(domain.subdomains.map((s) => s.category)));

  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = domain.subdomains.filter((s) => s.category === cat);
    return acc;
  }, {} as Record<string, typeof domain.subdomains>);

  const isAtMax = selectedSubdomains.length >= 3;

  return (
    <div className="subdomain-grid-root">
      {selectedSubdomains.length >= 3 && (
        <div className="max-warning">
          💡 Narrow focus improves depth — max 3 topics selected
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat} className="subdomain-category">
          <div className="cat-label">{cat}</div>
          <div className="cat-pills">
            {grouped[cat].map((sub: typeof domain.subdomains[number]) => {
              const isSelected = selectedSubdomains.includes(sub.id);
              const isDisabled = isAtMax && !isSelected;
              return (
                <button
                  key={sub.id}
                  className={`subdomain-pill ${
                    isSelected ? "selected" : ""
                  } ${isDisabled ? "disabled" : ""}`}
                  onClick={() => !isDisabled && onToggle(sub.id)}
                  title={sub.description}
                  style={
                    { "--pill-color": domain.color } as React.CSSProperties
                  }
                  disabled={isDisabled}
                >
                  <span className="pill-label">{sub.label}</span>
                  {sub.labelNative && (
                    <span className="pill-native">{sub.labelNative}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <style jsx>{`
        .subdomain-grid-root {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .max-warning {
          font-family: "Space Mono", monospace;
          font-size: 0.6rem;
          color: rgba(200, 146, 42, 0.7);
          background: rgba(200, 146, 42, 0.06);
          border: 1px solid rgba(200, 146, 42, 0.2);
          border-radius: 6px;
          padding: 0.4rem 0.6rem;
        }
        .subdomain-category {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .cat-label {
          font-family: "Space Mono", monospace;
          font-size: 0.55rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: rgba(245, 239, 232, 0.25);
        }
        .cat-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }
        .subdomain-pill {
          font-family: "Space Mono", monospace;
          font-size: 0.62rem;
          padding: 0.3em 0.7em;
          border-radius: 999px;
          border: 1px solid rgba(245, 240, 232, 0.1);
          background: rgba(255, 255, 255, 0.02);
          color: rgba(245, 239, 232, 0.65);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
        }
        .subdomain-pill:hover:not(.disabled) {
          border-color: var(--pill-color);
          color: #f5efe8;
          background: color-mix(
            in srgb,
            var(--pill-color) 8%,
            transparent
          );
        }
        .subdomain-pill.selected {
          border-color: var(--pill-color);
          background: color-mix(
            in srgb,
            var(--pill-color) 15%,
            transparent
          );
          color: #f5efe8;
          box-shadow: 0 0 8px
            color-mix(in srgb, var(--pill-color) 20%, transparent);
        }
        .subdomain-pill.disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .pill-native {
          font-size: 0.5rem;
          color: rgba(200, 146, 42, 0.5);
          line-height: 1;
        }
      `}</style>
    </div>
  );
}

