"use client";

import { RESEARCH_DOMAINS } from "@/lib/deep-research-config";
import { DEEP_RESEARCH_POSITIONING } from "@/lib/deep-research-positioning";

const AyurvedaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M8 20h8M12 20v-4M7 16s-3-2-3-6c0-3 2-5 4-5h8c2 0 4 2 4 5 0 4-3 6-3 6H7z" />
    <path d="M9 5c0-1.5 1.5-3 3-3s3 1.5 3 3" />
    <path d="M10 9c1-1 3-1 4 0" />
  </svg>
);

const HomeopathyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
    <ellipse cx="12" cy="8" rx="6" ry="3" />
    <path d="M6 8c0 4 2 7 6 7s6-3 6-7" />
    <path d="M15 5l3-3" />
    <path d="M8 20h8" />
  </svg>
);

const SiddhaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M2 12h3l2-5 3 10 2-7 2 4 2-2h6" />
  </svg>
);

const AllopathyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M12 7c3-2 6 0 6 3s-3 4-6 4" />
    <path d="M9 21h6" />
  </svg>
);

const UnaniIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M12 6c2-1 4 0 4 2s-2 3-4 3" />
    <path d="M12 11c2-1 4 0 4 2s-2 3-4 3" />
    <path d="M12 16c2-1 4 0 4 2" />
  </svg>
);

interface Props {
  selectedDomains: string[];
}

export function WorkspaceEmptyState({ selectedDomains }: Props) {
  const centerX = 250;
  const centerY = 200;
  const radius = 140;

  const nodes = RESEARCH_DOMAINS.map((domain, i) => {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    return {
      ...domain,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  return (
    <div className="empty-state">
      <div className="cosmos-map-container">
        <svg
          viewBox="0 0 500 400"
          className="cosmos-svg"
          role="img"
          aria-label="Medical traditions map"
        >
          <defs>
            {RESEARCH_DOMAINS.map((d) => (
              <radialGradient key={d.id} id={`glow-${d.id}`}>
                <stop
                  offset="0%"
                  stopColor={d.color}
                  stopOpacity="0.6"
                />
                <stop
                  offset="100%"
                  stopColor={d.color}
                  stopOpacity="0"
                />
              </radialGradient>
            ))}
            <radialGradient id="center-glow">
              <stop
                offset="0%"
                stopColor="#7C3AED"
                stopOpacity="0.8"
              />
              <stop
                offset="60%"
                stopColor="#7C3AED"
                stopOpacity="0.2"
              />
              <stop
                offset="100%"
                stopColor="#7C3AED"
                stopOpacity="0"
              />
            </radialGradient>
          </defs>

          <g className="orbit-layer">
            {nodes.map((node) => {
              const isActive = selectedDomains.includes(node.id);
              return (
                <line
                  key={`line-${node.id}`}
                  x1={centerX}
                  y1={centerY}
                  x2={node.x}
                  y2={node.y}
                  stroke={
                    isActive
                      ? node.color
                      : "rgba(245,239,232,0.06)"
                  }
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={isActive ? "none" : "4,6"}
                  className={isActive ? "line-active" : ""}
                />
              );
            })}

          <circle
            cx={centerX}
            cy={centerY}
            r={45}
            fill="url(#center-glow)"
            className="core-pulse"
          />
          <circle
            cx={centerX}
            cy={centerY}
            r={28}
            fill="rgba(124,58,237,0.15)"
            stroke="rgba(124,58,237,0.5)"
            strokeWidth={1.5}
          />
          <text
            x={centerX}
            y={centerY - 5}
            textAnchor="middle"
            fill="#F5EFE8"
            fontSize="8"
            fontFamily="Space Mono"
            fontWeight="700"
          >
            MANTHANA
          </text>
          <text
            x={centerX}
            y={centerY + 8}
            textAnchor="middle"
            fill="rgba(245,239,232,0.4)"
            fontSize="6"
            fontFamily="Space Mono"
          >
            RESEARCH
          </text>

          {nodes.map((node) => {
            const isActive = selectedDomains.includes(node.id);
            return (
              <g
                key={node.id}
                className={`domain-node ${isActive ? "active" : ""}`}
              >
                {isActive && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={32}
                    fill={`url(#glow-${node.id})`}
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={22}
                  fill={
                    isActive
                      ? `${node.color}18`
                      : "rgba(255,255,255,0.03)"
                  }
                  stroke={
                    isActive
                      ? node.color
                      : "rgba(245,239,232,0.1)"
                  }
                  strokeWidth={isActive ? 2 : 1}
                />
                <text
                  x={node.x}
                  y={node.y + 14}
                  textAnchor="middle"
                  fill={
                    isActive
                      ? "#F5EFE8"
                      : "rgba(245,239,232,0.3)"
                  }
                  fontSize="7"
                  fontFamily="Space Mono"
                >
                  {node.label.toUpperCase()}
                </text>
              </g>
            );
          })}
          </g>
        </svg>
      </div>

      <div className="empty-positioning" aria-label="Product scope">
        <p className="positioning-headline">
          {DEEP_RESEARCH_POSITIONING.headline}
        </p>
        <p className="positioning-contrast">
          {DEEP_RESEARCH_POSITIONING.notGeneralWebOracle}
        </p>
      </div>

      <div className="empty-instructions">
        {selectedDomains.length === 0 ? (
          <>
            <p className="instruction-title">Select domains to begin</p>
            <p className="instruction-sub">
              Pick any combination (one, several, or all five). Then set
              intent and run a cited synthesis — not the same as M5 chat on
              the home page.
            </p>
          </>
        ) : (
          <>
            <p className="instruction-title">
              {selectedDomains.length} tradition
              {selectedDomains.length > 1 ? "s" : ""} selected
            </p>
            <p className="instruction-sub">
              Now select subdomains, define your research intent, and
              enter your research question.
            </p>
          </>
        )}
      </div>

      <style jsx>{`
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 500px;
          gap: 2rem;
        }
        .empty-positioning {
          text-align: center;
          max-width: 28rem;
          padding: 0 1rem;
        }
        .positioning-headline {
          font-family: "Lora", serif;
          font-size: 0.88rem;
          color: rgba(245, 239, 232, 0.82);
          line-height: 1.45;
          margin: 0 0 0.5rem;
        }
        .positioning-contrast {
          font-family: "Space Mono", monospace;
          font-size: 0.58rem;
          letter-spacing: 0.05em;
          color: rgba(167, 243, 208, 0.75);
          line-height: 1.45;
          margin: 0;
        }
        .cosmos-map-container {
          width: 100%;
          max-width: 520px;
        }
        .cosmos-svg {
          width: 100%;
          height: auto;
          filter: drop-shadow(0 0 18px rgba(76, 29, 149, 0.45));
        }
        .core-pulse {
          animation: corePulse 3s ease-in-out infinite;
        }
        @keyframes corePulse {
          0%,
          100% {
            opacity: 0.6;
            r: 45;
          }
          50% {
            opacity: 1;
            r: 52;
          }
        }
        .orbit-layer {
          transform-origin: 250px 200px;
          animation: orbit 48s linear infinite;
        }
        @keyframes orbit {
          0% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(185deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .domain-node {
          transition: transform 0.4s ease, opacity 0.4s ease;
          transform-origin: center;
          opacity: 0.8;
        }
        .domain-node.active circle:last-of-type {
          animation: nodePulse 2s ease-in-out infinite;
        }
        @keyframes nodePulse {
          0%,
          100% {
            opacity: 0.9;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.04);
          }
        }
        .line-active {
          animation: lineGlow 2s ease-in-out infinite;
        }
        @keyframes lineGlow {
          0%,
          100% {
            opacity: 0.55;
          }
          50% {
            opacity: 0.95;
          }
        }
        .empty-instructions {
          text-align: center;
          max-width: 420px;
          padding: 0 1rem;
        }
        .instruction-title {
          font-family: "Space Mono", monospace;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: rgba(245, 239, 232, 0.9);
          margin-bottom: 0.35rem;
        }
        .instruction-sub {
          font-family: "Lora", serif;
          font-size: 0.8rem;
          color: rgba(245, 239, 232, 0.6);
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}

