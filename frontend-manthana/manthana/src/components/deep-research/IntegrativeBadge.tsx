"use client";

import { RESEARCH_DOMAINS } from "@/lib/deep-research-config";

interface Props {
  domains: string[];
}

export function IntegrativeBadge({ domains }: Props) {
  const labels = domains
    .map((d) => RESEARCH_DOMAINS.find((r) => r.id === d)?.label)
    .filter(Boolean) as string[];

  if (labels.length < 2) return null;

  return (
    <div className="integrative-badge">
      <span className="badge-star">✦</span>
      <span className="badge-text">
        Integrative Research Mode — {labels.join(" + ")}
      </span>
      <style jsx>{`
        .integrative-badge {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.85rem;
          background: linear-gradient(
            135deg,
            rgba(200, 146, 42, 0.08),
            rgba(124, 58, 237, 0.08)
          );
          border: 1px solid rgba(200, 146, 42, 0.3);
          border-radius: 8px;
          animation: badgeShimmer 3s ease-in-out infinite;
        }
        @keyframes badgeShimmer {
          0%,
          100% {
            border-color: rgba(200, 146, 42, 0.3);
          }
          50% {
            border-color: rgba(200, 146, 42, 0.6);
          }
        }
        .badge-star {
          color: #f0c060;
          font-size: 0.9rem;
        }
        .badge-text {
          font-family: "Cormorant Garamond", serif;
          font-size: 0.8rem;
          font-style: italic;
          color: #f0c060;
        }
      `}</style>
    </div>
  );
}

