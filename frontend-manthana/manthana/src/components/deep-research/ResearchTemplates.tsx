"use client";

import {
  RESEARCH_TEMPLATES,
  type ResearchTemplate,
} from "@/lib/deep-research-config";

interface Props {
  onLoad: (t: ResearchTemplate) => void;
}

export function ResearchTemplates({ onLoad }: Props) {
  return (
    <div className="templates">
      <div className="templates-label">⚡ Quick Templates</div>
      <div className="templates-list">
        {RESEARCH_TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="template-btn"
            onClick={() => onLoad(t)}
          >
            <span className="t-label">{t.label}</span>
            <span className="t-sub">{t.subtitle}</span>
          </button>
        ))}
      </div>
      <style jsx>{`
        .templates {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .templates-label {
          font-family: "Space Mono", monospace;
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(245, 239, 232, 0.3);
        }
        .templates-list {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .template-btn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.1rem;
          padding: 0.6rem 0.8rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(245, 240, 232, 0.07);
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
          width: 100%;
        }
        .template-btn:hover {
          border-color: rgba(124, 58, 237, 0.3);
          background: rgba(124, 58, 237, 0.04);
        }
        .t-label {
          font-family: "Space Mono", monospace;
          font-size: 0.65rem;
          color: #f5efe8;
        }
        .t-sub {
          font-family: "Space Mono", monospace;
          font-size: 0.55rem;
          color: rgba(200, 146, 42, 0.5);
        }
      `}</style>
    </div>
  );
}

