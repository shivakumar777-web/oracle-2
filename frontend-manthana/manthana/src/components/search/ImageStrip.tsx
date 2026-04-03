"use client";

import React, { useRef } from "react";
import Link from "next/link";
import type { ImageResult } from "@/lib/api";
import { toViewerHref } from "@/lib/viewer-url";

interface ImageStripProps {
  images: ImageResult[];
  onViewAll?: () => void;
}

export default function ImageStrip({ images, onViewAll }: ImageStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!images.length) return null;

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 320 : -320, behavior: "smooth" });
  };

  return (
    <section className="mb-5">
      {/* Label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[#C8922A] font-mono tracking-widest uppercase">
          🖼 Medical Images
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="w-5 h-5 rounded flex items-center justify-center
              text-cream/30 hover:text-cream/70 hover:bg-white/[0.05] transition-colors text-xs"
          >
            ‹
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-5 h-5 rounded flex items-center justify-center
              text-cream/30 hover:text-cream/70 hover:bg-white/[0.05] transition-colors text-xs"
          >
            ›
          </button>
        </div>
      </div>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {images.slice(0, 6).map((img, idx) => {
          const pageUrl = img.sourceUrl || img.url;
          const vh = toViewerHref(pageUrl);
          const cls =
            "flex-shrink-0 w-[140px] rounded-md overflow-hidden bg-[#0D1B3E]/80 border border-white/[0.06] hover:border-[#C8922A]/30 transition-all group block";
          const inner = (
            <>
            <div className="relative w-[140px] h-[100px] bg-[#0A1628]">
              <img
                src={img.thumbnail || img.url}
                alt={img.title}
                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                loading="lazy"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                }}
              />
              {/* Source badge */}
              <span
                className="absolute bottom-1 left-1 text-[8px] bg-black/60 text-cream/70
                  px-1.5 py-0.5 rounded font-mono"
              >
                {img.source}
              </span>
            </div>
            <div className="px-2 py-1.5">
              <p className="text-[9px] text-cream/50 line-clamp-2 leading-tight">
                {img.title}
              </p>
            </div>
            </>
          );
          return vh ? (
            <Link key={idx} href={vh} className={cls}>
              {inner}
            </Link>
          ) : (
            <a
              key={idx}
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cls}
            >
              {inner}
            </a>
          );
        })}

        {/* View all */}
        {(images.length > 6 || onViewAll) && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex-shrink-0 w-[100px] flex items-center justify-center rounded-lg border border-gold/20 hover:border-gold/40 hover:bg-gold/5 transition-colors"
          >
            <span className="text-[10px] text-[#C8922A]/70 hover:text-[#C8922A]">
              View all images →
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
