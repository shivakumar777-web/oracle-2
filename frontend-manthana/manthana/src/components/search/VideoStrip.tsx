"use client";

import React from "react";
import Link from "next/link";
import type { VideoResult } from "@/lib/api";
import { toViewerHref } from "@/lib/viewer-url";

interface VideoStripProps {
  videos: VideoResult[];
  onViewAll?: () => void;
}

function getVideoIcon(source: string): string {
  if (source.includes("youtube")) return "▶";
  if (source.includes("vimeo")) return "▶";
  if (source.includes("medscape")) return "🎬";
  return "▶";
}

export default function VideoStrip({ videos, onViewAll }: VideoStripProps) {
  if (!videos.length) return null;

  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[#C8922A] font-mono tracking-widest uppercase">
          🎥 Medical Videos
        </span>
        {(videos.length > 4 || onViewAll) && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[10px] text-[#C8922A]/70 hover:text-[#C8922A] font-mono tracking-widest uppercase transition-colors"
          >
            View all videos →
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {videos.slice(0, 4).map((video, idx) => {
          const vh = toViewerHref(video.url);
          const shellClass =
            "group rounded-md overflow-hidden bg-[#0D1B3E]/60 border border-white/[0.06] hover:border-[#C8922A]/30 transition-all block";
          const body = (
            <>
              <div className="relative w-full aspect-video bg-[#0A1628] overflow-hidden">
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                    loading="lazy"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#0F2040]">
                    <span className="text-cream/20 text-2xl">🎬</span>
                  </div>
                )}
                <div
                  className="absolute inset-0 flex items-center justify-center
                  opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div
                    className="w-10 h-10 rounded-full bg-black/70 flex items-center justify-center
                    text-white text-lg"
                  >
                    {getVideoIcon(video.source)}
                  </div>
                </div>
                <span
                  className="absolute bottom-1 right-1 text-[8px] bg-black/70 text-cream/70
                  px-1 py-0.5 rounded font-mono"
                >
                  {video.source}
                </span>
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[11px] text-cream/75 line-clamp-2 leading-snug">
                  {video.title}
                </p>
                {video.publishedDate && (
                  <p className="text-[9px] text-cream/30 mt-0.5">
                    {video.publishedDate}
                  </p>
                )}
              </div>
            </>
          );
          return vh ? (
            <Link key={idx} href={vh} className={shellClass}>
              {body}
            </Link>
          ) : (
            <a
              key={idx}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className={shellClass}
            >
              {body}
            </a>
          );
        })}
      </div>
    </section>
  );
}
