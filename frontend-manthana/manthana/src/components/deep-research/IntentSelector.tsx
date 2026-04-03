"use client";

import { RESEARCH_INTENTS } from "@/lib/deep-research-config";

interface Props {
  selected: string | null;
  onSelect: (id: string) => void;
}

export function IntentSelector({ selected, onSelect }: Props) {
  return (
    <div className="intent-grid">
      {RESEARCH_INTENTS.map((intent) => {
        const isSelected = selected === intent.id;
        return (
          <button
            key={intent.id}
            className={`intent-card ${isSelected ? "selected" : ""}`}
            onClick={() => onSelect(intent.id)}
            aria-pressed={isSelected}
          >
            <div className="intent-icon">{intent.icon}</div>
            <div className="intent-label">{intent.label}</div>
            <div className="intent-desc">{intent.description}</div>
            <div className="intent-tags">
              {intent.tags.map((tag) => (
                <span key={tag} className="intent-tag">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        );
      })}

      <style jsx>{`
        .intent-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }
        .intent-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.3rem;
          padding: 0.85rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(245, 240, 232, 0.07);
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }
        .intent-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at 50% 0%,
            rgba(124, 58, 237, 0.12),
            transparent 70%
          );
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .intent-card:hover::before {
          opacity: 1;
        }
        .intent-card:hover {
          border-color: rgba(124, 58, 237, 0.35);
        }
        .intent-card.selected {
          border-color: #7c3aed;
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.2),
            inset 0 0 20px rgba(124, 58, 237, 0.05);
        }
        .intent-card.selected::before {
          opacity: 1;
        }
        .intent-icon {
          font-size: 1.5rem;
          position: relative;
          z-index: 1;
        }
        .intent-label {
          font-family: "Space Mono", monospace;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #f5efe8;
          position: relative;
          z-index: 1;
          line-height: 1.3;
        }
        .intent-desc {
          font-family: "Lora", serif;
          font-size: 0.65rem;
          color: rgba(245, 239, 232, 0.45);
          line-height: 1.4;
          font-style: italic;
          position: relative;
          z-index: 1;
        }
        .intent-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          margin-top: 0.25rem;
          position: relative;
          z-index: 1;
        }
        .intent-tag {
          font-family: "Space Mono", monospace;
          font-size: 0.5rem;
          padding: 0.15em 0.5em;
          border-radius: 999px;
          background: rgba(200, 146, 42, 0.1);
          border: 1px solid rgba(200, 146, 42, 0.25);
          color: rgba(200, 146, 42, 0.7);
        }
      `}</style>
    </div>
  );
}

