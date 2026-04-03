"use client";

import React from "react";
import DOMPurify from "dompurify";
import Logo from "./Logo";
import ChurningState from "./ChurningState";
import M5Message from "./M5Message";
import type { M5DomainAnswer, M5Summary } from "@/lib/api";

/** Reject javascript:, data:, vbscript: and other dangerous URL schemes */
function safeHref(url: string): string {
  const u = (url || "").trim();
  if (/^(javascript|data|vbscript|file):/i.test(u)) return "#";
  return u;
}

export type MessageRole = "user" | "assistant";

export interface Source {
  title: string;
  url: string;
  domain: string;
  trustScore?: number;
}

export interface ChatMessageData {
  id: string;
  role: MessageRole;
  content: string;
  domains?: string[];
  sources?: Source[];
  confidence?: number;
  sourcesCount?: number;
  verified?: boolean;
  streaming?: boolean;
  mode?: string;
  // M5 mode fields
  isM5?: boolean;
  m5Query?: string;
  m5Answers?: M5DomainAnswer[];
  m5Summary?: M5Summary;
}

interface ChatMessageProps {
  message: ChatMessageData;
}

const DOMAIN_BADGE_COLORS: Record<string, string> = {
  ayurveda: "bg-gold/10 text-gold-h border-gold/25",
  clinical: "bg-blue-500/10 text-blue-300 border-blue-500/25",
  allopathy: "bg-blue-500/10 text-blue-300 border-blue-500/25",
  homeopathy: "bg-purple-500/10 text-purple-300 border-purple-500/25",
  siddha: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  unani: "bg-teal/10 text-teal-h border-teal/25",
};

export default function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end px-4 py-2">
        <div
          className="max-w-[72%] rounded-2xl rounded-tr-sm px-5 py-3.5
            bg-teal/[0.06] border-l-2 border-teal-m"
        >
          <p className="font-body text-sm text-cream/80 leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Response Header */}
      <div className="flex items-center gap-3 mb-4">
        <Logo size="nav" animate={false} />
        <span className="font-ui text-xs tracking-[0.15em] uppercase text-gold-h">
          MANTHANA
        </span>

        {message.mode === "deep-research" && (
          <span className="font-ui text-[9px] px-2 py-0.5 rounded-full border border-gold/40 text-gold/80 uppercase tracking-wider">
            Deep Research
          </span>
        )}

        {/* Domain badges */}
        {message.domains && message.domains.length > 0 && (
          <div className="flex items-center gap-1.5">
            {message.domains.map((d) => (
              <span
                key={d}
                className={`font-ui text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-wider
                  ${DOMAIN_BADGE_COLORS[d.toLowerCase()] ?? "bg-white/5 text-cream/40 border-white/10"}`}
              >
                {d}
              </span>
            ))}
          </div>
        )}

        {/* AMRITA VERIFIED badge */}
        {message.verified && (
          <span className="font-ui text-[9px] text-gold-m tracking-[0.08em] uppercase ml-auto flex items-center gap-1">
            <span className="text-base leading-none">✦</span> AMRITA VERIFIED
          </span>
        )}
      </div>

      {/* Response body + sources (Perplexity-style) OR M5 Message */}
      <div className="font-body text-sm text-cream/75 leading-[1.85] pl-9 space-y-3">
        {message.isM5 ? (
          <M5Message
            query={message.m5Query || ""}
            answers={message.m5Answers || []}
            summary={message.m5Summary}
            isStreaming={message.streaming}
          />
        ) : message.streaming ? (
          <div className="py-4">
            <ChurningState mode={message.mode} />
          </div>
        ) : (
          <PerplexityResponse
            content={message.content}
            sources={message.sources}
            confidence={message.confidence}
          />
        )}
        {/* Hidden placeholder to prevent layout shift; never render partial content */}
        {!message.isM5 && message.streaming && message.content && (
          <div className="hidden" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

function markdown(content: string): string {
  let html = content;
  // Bold **text**
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="text-cream/90 font-semibold">$1</strong>',
  );
  // Italic *text* (but not **)
  html = html.replace(
    /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
    '<em class="text-cream/80 italic">$1</em>',
  );
  // ### Heading
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 class="font-ui text-sm text-gold-h tracking-wide mt-4 mb-2">$1</h3>',
  );
  // ## Heading
  html = html.replace(
    /^## (.+)$/gm,
    '<h3 class="font-ui text-sm text-gold-h tracking-wide mt-4 mb-2">$1</h3>',
  );
  // - Bullet
  html = html.replace(
    /^- (.+)$/gm,
    '<div class="flex gap-2 mt-1"><span class="text-gold-d mt-0.5 flex-shrink-0">◆</span><span>$1</span></div>',
  );
  // Numbered list
  html = html.replace(
    /^\d+\.\s(.+)$/gm,
    '<div class="flex gap-2 mt-1"><span class="text-teal-m mt-0.5 flex-shrink-0 font-mono text-xs">- </span><span>$1</span></div>',
  );
  // Horizontal rule ---
  html = html.replace(
    /^---$/gm,
    '<hr class="border-t border-white/10 my-3" />',
  );
  // Links [text](url) — sanitize href to prevent XSS (javascript:, data:, etc.)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, url) => {
      const safe = safeHref(url);
      const escaped = (text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<a href="${safe.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer" class="text-teal-m underline hover:text-teal-h">${escaped}</a>`;
    },
  );
  // Inline code `code`
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-white/5 text-teal-h px-1 rounded font-mono text-xs">$1</code>',
  );
  // Sanitize with DOMPurify (client-only; SSR falls through with URL sanitization above)
  if (typeof DOMPurify !== "undefined" && DOMPurify.sanitize) {
    html = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["a", "strong", "em", "h3", "div", "span", "hr", "code"],
      ALLOWED_ATTR: ["href", "target", "rel", "class"],
    });
  }
  return html;
}

function PerplexityResponse({
  content,
  sources,
  confidence,
}: {
  content: string;
  sources?: Source[];
  confidence?: number;
}) {
  const safeHtml = markdown(content);
  const displayConfidence = confidence ?? 85;

  return (
    <div className="space-y-4">
      {/* Answer */}
      <div
        className="prose prose-invert max-w-none prose-p:mb-2 prose-headings:mt-4 prose-headings:mb-2"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />

      {/* Sources bar */}
      {sources && sources.length > 0 && (
        <div className="pt-4 border-t border-gold/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 bg-gold rounded-full mt-0.5" />
            <span className="text-xs uppercase tracking-wider text-gold/80">
              {sources.length} SOURCES
            </span>
            <span className="ml-auto text-xs text-cream/60">
              {displayConfidence}% CONFIDENCE
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {sources.slice(0, 6).map((src, i) => {
              const cn = "group p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex gap-2 items-start hover:scale-[1.01] transition-all";
              const inner = (
                <>
                  <div className="w-6 h-6 bg-gold/20 rounded flex items-center justify-center text-gold text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-cream/90 line-clamp-1">
                      {src.title || src.domain || "Source"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-cream/50 truncate">
                        {src.domain || src.url}
                      </p>
                      {src.trustScore != null && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/90 border border-gold/20">
                          {src.trustScore}+
                        </span>
                      )}
                    </div>
                  </div>
                </>
              );
              return src.url ? (
                <a key={`${src.url}-${i}`} href={src.url} target="_blank" rel="noopener noreferrer" className={cn}>
                  {inner}
                </a>
              ) : (
                <div key={`${src.title}-${i}`} className={cn}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 pt-4 border-t border-teal/30">
        <p className="text-xs italic text-teal/70">
          ⚕️ Answers are for research and education. Consult a qualified
          healthcare professional before making medical decisions.
        </p>
      </div>
    </div>
  );
}
