"use client";

import React, { useEffect, useRef } from "react";

export default function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    const STAR_COUNT = isMobile ? 100 : 200;

    // Seeded random for deterministic star placement
    let seed = 42;
    const seededRandom = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();

    // Generate stars once
    const stars: { x: number; y: number; r: number; a: number }[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: seededRandom() * canvas.width,
        y: seededRandom() * canvas.height,
        r: seededRandom() * 1 + 0.2,
        a: seededRandom() * 0.5 + 0.15,
      });
    }

    // Draw ONCE — static stars, no animation loop
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const star of stars) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 240, 232, ${star.a})`;
      ctx.fill();
    }

    // Only redraw on resize
    const handleResize = () => {
      resize();
      seed = 42; // Reset seed for same positions
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.x = seededRandom() * canvas.width;
        s.y = seededRandom() * canvas.height;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 240, 232, ${s.a})`;
        ctx.fill();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Cosmic gradient layers */}
      <div className="absolute inset-0 cosmic-bg" />

      {/* Dot grid overlay */}
      <div className="absolute inset-0 dot-grid" />

      {/* Star canvas — static, no animation loop */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        aria-hidden="true"
      />
    </div>
  );
}
