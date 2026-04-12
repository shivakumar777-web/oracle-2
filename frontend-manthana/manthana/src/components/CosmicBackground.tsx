"use client";

import React, { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  r: number;
  baseA: number;
  phase: number;
  /** Rad/s — slower = gentler “distant” twinkle */
  speed: number;
  /** Second frequency multiplier for irregular shimmer */
  jitter: number;
};

export default function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let seed = 42;
    const seededRandom = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    let stars: Star[] = [];
    let rafId = 0;

    const buildStars = () => {
      const isMobile = window.innerWidth < 768;
      const STAR_COUNT = isMobile ? 140 : 280;
      seed = 42;
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        const r = seededRandom() * 1 + 0.2;
        stars.push({
          x: seededRandom() * canvas.width,
          y: seededRandom() * canvas.height,
          r,
          baseA: seededRandom() * 0.42 + 0.1,
          phase: seededRandom() * Math.PI * 2,
          speed: seededRandom() * 1.4 + 0.35,
          jitter: seededRandom() * 0.5 + 0.85,
        });
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      buildStars();
    };

    resize();

    const drawFrame = (now: number) => {
      const t = now * 0.001;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const star of stars) {
        const s1 = Math.sin(t * star.speed + star.phase);
        const s2 = Math.sin(t * star.speed * star.jitter + star.phase * 1.7);
        const s3 = Math.sin(t * star.speed * 0.47 + star.phase * 2.3);
        const mix = 0.5 + 0.38 * s1 + 0.2 * s2 + 0.12 * s3;
        const pulse = 0.28 + 1.15 * mix;
        const alpha = Math.min(
          0.98,
          Math.max(0.06, star.baseA * pulse)
        );

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 240, 232, ${alpha})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(drawFrame);
    };

    rafId = requestAnimationFrame(drawFrame);

    const handleResize = () => {
      resize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Cosmic gradient layers */}
      <div className="absolute inset-0 z-0 cosmic-bg" />

      {/* Dot grid (static); canvas above so twinkle reads clearly */}
      <div className="absolute inset-0 z-[1] dot-grid" />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[2] mix-blend-screen"
        aria-hidden="true"
      />
    </div>
  );
}
