"use client";

import {
  RESEARCH_DOMAINS,
  RESEARCH_INTENTS,
  DEPTH_CONFIG,
} from "@/lib/deep-research-config";

interface Props {
  domains: string[];
  subdomains: Record<string, string[]>;
  intent: string | null;
  depth: string;
}

export function ResearchContextPill({
  domains,
  subdomains,
  intent,
  depth,
}: Props) {
  if (domains.length === 0) return null;

  const domainLabels = domains
    .map((d) => {
      const dom = RESEARCH_DOMAINS.find((r) => r.id === d);
      return dom ? dom.label : d;
    })
    .join(" · ");

  const allSubs = Object.values(subdomains).flat();
  const intentLabel =
    RESEARCH_INTENTS.find((i) => i.id === intent)?.label || "";
  const depthLabel =
    DEPTH_CONFIG[depth as keyof typeof DEPTH_CONFIG]?.label || "";

  return (
    <div className="context-pill">
      <span>{domainLabels}</span>
      {allSubs.length > 0 && (
        <span>
          {" "}
          · {allSubs.length} topic
          {allSubs.length > 1 ? "s" : ""}
        </span>
      )}
      {intentLabel && <span> · {intentLabel}</span>}
      {depthLabel && <span> · {depthLabel}</span>}
      <style jsx>{`
        .context-pill {
          font-family: "Space Mono", monospace;
          font-size: 0.6rem;
          color: rgba(200, 146, 42, 0.7);
          background: rgba(200, 146, 42, 0.05);
          border: 1px solid rgba(200, 146, 42, 0.15);
          border-radius: 999px;
          padding: 0.35em 0.85em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
}

