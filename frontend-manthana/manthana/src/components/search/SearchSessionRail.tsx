"use client";

import React, { useRef, useState } from "react";

export type SessionChip = {
  id: string;
  /** Short label (truncated query or "New search") */
  label: string;
};

type Props = {
  sessions: SessionChip[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  /** New in-app session (empty search in this window) */
  onAddSession: () => void;
  /** Opens a new browser tab — Google-style fresh tab */
  onOpenBrowserTab: () => void;
};

const SWIPE_CLOSE_PX = 72;

/**
 * Horizontal session chips: desktop shows ×; mobile supports horizontal swipe-left to dismiss (Google-tab-switcher feel).
 */
export default function SearchSessionRail({
  sessions,
  activeId,
  onSelect,
  onClose,
  onAddSession,
  onOpenBrowserTab,
}: Props) {
  return (
    <div className="border-b border-white/[0.04] bg-[#020618]/40">
      <p className="sm:hidden px-4 pt-2 pb-0 text-[9px] text-cream/25 leading-snug">
        Swipe a session chip left to close · <span className="text-cream/40">↗ New tab</span> opens a fresh search in a new browser tab (like Google)
      </p>
      <div className="flex items-center gap-2 px-4 py-1.5">
      <span className="hidden sm:inline font-ui text-[9px] text-cream/25 uppercase tracking-wider flex-shrink-0">
        Sessions
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {sessions.map((s) => (
          <SwipeableSessionChip
            key={s.id}
            session={s}
            active={s.id === activeId}
            onSelect={() => onSelect(s.id)}
            onClose={() => onClose(s.id)}
          />
        ))}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onAddSession}
          title="New search session in this window"
          aria-label="New search session in this window"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-white/15 text-cream/50
            hover:border-gold/40 hover:text-gold-h text-sm font-medium transition-colors"
        >
          +
        </button>
        <button
          type="button"
          onClick={onOpenBrowserTab}
          title="Open a new browser tab (like Google new tab)"
          aria-label="Open new browser tab"
          className="hidden sm:flex h-8 items-center gap-1 rounded-md border border-white/[0.08] px-2 text-[10px] font-ui text-cream/45
            hover:border-gold/30 hover:text-cream/70 transition-colors"
        >
          <span aria-hidden>↗</span>
          <span>New tab</span>
        </button>
      </div>
      </div>
    </div>
  );
}

function SwipeableSessionChip({
  session,
  active,
  onSelect,
  onClose,
}: {
  session: SessionChip;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef(0);
  const tracking = useRef(false);
  const lastDx = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    startX.current = e.touches[0]!.clientX;
    tracking.current = true;
    lastDx.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!tracking.current || !e.touches[0]) return;
    const dx = e.touches[0].clientX - startX.current;
    lastDx.current = dx;
    if (dx < 0) setDragX(Math.max(dx, -SWIPE_CLOSE_PX * 1.2));
    else if (dx > 0) setDragX(0);
  };

  const onTouchEnd = () => {
    if (!tracking.current) return;
    tracking.current = false;
    if (lastDx.current < -SWIPE_CLOSE_PX * 0.55) {
      onClose();
    }
    setDragX(0);
  };

  return (
    <div
      className="relative flex-shrink-0 max-w-[140px] sm:max-w-[180px]"
      style={{
        transform: `translateX(${dragX}px)`,
        transition: tracking.current ? "none" : "transform 0.2s ease-out",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#0D1B3E]/70 pr-1">
        <button
          type="button"
          onClick={onSelect}
          className={`min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[10px] font-ui transition-colors ${
            active ? "text-gold-h" : "text-cream/55 hover:text-cream/80"
          }`}
        >
          {session.label}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="hidden sm:flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-cream/30 hover:bg-white/[0.08] hover:text-cream/80"
          aria-label={`Close session ${session.label}`}
        >
          ×
        </button>
      </div>
      {dragX < -24 && (
        <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-[9px] text-red-400/90 sm:hidden">
          Release to close
        </span>
      )}
    </div>
  );
}
