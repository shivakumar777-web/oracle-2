"use client";

import { useRef, useState, useEffect } from "react";

interface Props {
  query: string;
  onChange: (q: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled: boolean;
  onOpenSettings?: () => void;
}

const PLACEHOLDERS = [
  "Compare Arjuna bark vs. ACE inhibitors in heart failure...",
  "Systematic review of Ashwagandha in anxiety disorders...",
  "Panchakarma efficacy in rheumatoid arthritis — thesis review...",
  "STEMI management protocol — latest guidelines 2024...",
  "Noi Naadal pulse diagnosis correlation with modern biomarkers...",
  "Miasmatic analysis of PCOS — homoeopathic perspective...",
  "Varma therapy in post-stroke rehabilitation — clinical evidence...",
];

export function ResearchBar({
  query,
  onChange,
  onSubmit,
  isLoading,
  disabled,
  onOpenSettings,
}: Props) {
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const interval = setInterval(
      () =>
        setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length),
      4000,
    );
    return () => clearInterval(interval);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="research-bar">
      <textarea
        ref={textareaRef}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={PLACEHOLDERS[placeholderIdx]}
        disabled={isLoading}
        rows={3}
        className="research-textarea"
        aria-label="Research question"
      />
      <div className="research-actions">
        <button
          onClick={onSubmit}
          disabled={disabled || isLoading}
          className={`research-cta ${isLoading ? "loading" : ""}`}
        >
          {isLoading ? (
            <span className="cta-spinner" aria-hidden="true" />
          ) : (
            <span>INITIATE RESEARCH 🔱</span>
          )}
        </button>
        {onOpenSettings && (
          <button
            type="button"
            className="settings-btn"
            onClick={onOpenSettings}
            aria-label="Deep Research settings"
          >
            ⚙
          </button>
        )}
      </div>
      <style jsx>{`
        .research-bar {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .research-textarea {
          width: 100%;
          padding: 0.85rem;
          resize: none;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(124, 58, 237, 0.25);
          border-radius: 10px;
          color: #f5efe8;
          font-family: "Lora", serif;
          font-size: 0.82rem;
          line-height: 1.6;
          outline: none;
          transition: border-color 0.2s ease;
        }
        .research-textarea::placeholder {
          color: rgba(245, 239, 232, 0.2);
          font-style: italic;
        }
        .research-textarea:focus {
          border-color: rgba(124, 58, 237, 0.6);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08);
        }
        .research-actions {
          display: flex;
          gap: 0.4rem;
          align-items: center;
        }
        .research-cta {
          flex: 1;
          padding: 0.85rem;
          background: linear-gradient(
            135deg,
            #6d28d9,
            #7c3aed,
            #5b21b6
          );
          background-size: 200% auto;
          border: none;
          border-radius: 10px;
          font-family: "Space Mono", monospace;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #f5efe8;
          text-transform: uppercase;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          transition: background-position 0.4s ease, transform 0.1s ease,
            box-shadow 0.1s ease, opacity 0.2s ease;
        }
        .research-cta:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.4);
          transform: translateY(-1px);
        }
        .research-cta:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .settings-btn {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px solid rgba(124, 58, 237, 0.35);
          background: rgba(5, 4, 15, 0.9);
          color: rgba(245, 239, 232, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .settings-btn:hover {
          border-color: rgba(200, 146, 42, 0.7);
          color: #f0c060;
          box-shadow: 0 0 12px rgba(124, 58, 237, 0.4);
          transform: translateY(-1px);
        }
        .cta-spinner {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          border: 2px solid rgba(245, 239, 232, 0.25);
          border-top-color: #f5efe8;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

