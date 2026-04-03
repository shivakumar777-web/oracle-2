"use client";

interface Props {
  activeStep: number;
}

// Wizard steps:
// ① Domain  → choose medical traditions and inline subdomains
// ② Intent  → choose research intent
// ③ Depth   → choose depth / source filters
// ④ Research → results view
const STEPS = ["Domain", "Intent", "Depth", "Research"];

export function StepIndicator({ activeStep }: Props) {
  return (
    <div className="step-indicator">
      {STEPS.map((label, idx) => {
        const step = idx + 1;
        const isDone = activeStep > step;
        const isActive = activeStep === step;
        return (
          <div key={step} className="step-item" aria-label={label}>
            <div
              className={`step-dot ${
                isDone ? "done" : isActive ? "active" : ""
              }`}
            >
              {isDone ? "✓" : step}
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`step-line ${isDone ? "done" : ""}`} />
            )}
          </div>
        );
      })}
      <style jsx>{`
        .step-indicator {
          display: flex;
          align-items: center;
          gap: 0;
          margin-bottom: 0.5rem;
        }
        .step-item {
          display: flex;
          align-items: center;
        }
        .step-dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1.5px solid rgba(245, 240, 232, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "Space Mono", monospace;
          font-size: 0.6rem;
          color: rgba(245, 239, 232, 0.3);
          transition: all 0.3s ease;
          flex-shrink: 0;
        }
        .step-dot.done {
          background: rgba(200, 146, 42, 0.2);
          border-color: #c8922a;
          color: #c8922a;
        }
        .step-dot.active {
          background: rgba(124, 58, 237, 0.2);
          border-color: #7c3aed;
          color: #7c3aed;
          animation: stepPulse 2s ease-in-out infinite;
        }
        @keyframes stepPulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(124, 58, 237, 0);
          }
        }
        .step-line {
          flex: 1;
          height: 1px;
          min-width: 16px;
          background: rgba(245, 240, 232, 0.08);
          transition: background 0.3s ease;
        }
        .step-line.done {
          background: rgba(200, 146, 42, 0.3);
        }
      `}</style>
    </div>
  );
}

