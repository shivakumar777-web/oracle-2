"use client";

import React from "react";

interface LogoProps {
  size?: "hero" | "nav" | "inline";
  animate?: boolean;
  className?: string;
}

/* ═══════════════════════════════════════════════
   Pre-compute JS-populated elements from
   manthana-elite.html (outer ticks, inner ticks,
   arm nodes, sun rays)
   ═══════════════════════════════════════════════ */

function outerTicks() {
  const cx = 130, cy = 130, r1 = 112.5, r0maj = 108, r0min = 110.2;
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < 60; i++) {
    const a = ((i * 6 - 90) * Math.PI) / 180;
    const maj = i % 5 === 0;
    const r0 = maj ? r0maj : r0min;
    lines.push(
      <line
        key={`ot${i}`}
        x1={(cx + r0 * Math.cos(a)).toFixed(2)}
        y1={(cy + r0 * Math.sin(a)).toFixed(2)}
        x2={(cx + r1 * Math.cos(a)).toFixed(2)}
        y2={(cy + r1 * Math.sin(a)).toFixed(2)}
        stroke={maj ? "rgba(212,168,71,.52)" : "rgba(212,168,71,.18)"}
        strokeWidth={maj ? 1.1 : 0.42}
      />
    );
  }
  return lines;
}

function innerTicks() {
  const cx = 130, cy = 130, r1 = 59;
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < 24; i++) {
    const a = ((i * 15 - 90) * Math.PI) / 180;
    const maj = i % 6 === 0;
    const r0 = maj ? 54.5 : 55.8;
    lines.push(
      <line
        key={`it${i}`}
        x1={(cx + r0 * Math.cos(a)).toFixed(2)}
        y1={(cy + r0 * Math.sin(a)).toFixed(2)}
        x2={(cx + r1 * Math.cos(a)).toFixed(2)}
        y2={(cy + r1 * Math.sin(a)).toFixed(2)}
        stroke={maj ? "rgba(212,168,71,.4)" : "rgba(212,168,71,.14)"}
        strokeWidth={maj ? 0.9 : 0.38}
      />
    );
  }
  return lines;
}

function armNodes() {
  const arms = [
    { p0: { x: 130, y: 35 }, p1: { x: 173.84, y: 86.16 }, p2: { x: 158, y: 130 }, p3: { x: 130, y: 130 } },
    { p0: { x: 220.4, y: 100.6 }, p1: { x: 185.24, y: 158.15 }, p2: { x: 138.65, y: 156.63 }, p3: { x: 130, y: 130 } },
    { p0: { x: 185.8, y: 206.9 }, p1: { x: 120.36, y: 191.24 }, p2: { x: 107.35, y: 146.47 }, p3: { x: 130, y: 130 } },
    { p0: { x: 74.2, y: 206.9 }, p1: { x: 68.76, y: 139.64 }, p2: { x: 107.35, y: 113.53 }, p3: { x: 130, y: 130 } },
    { p0: { x: 39.6, y: 100.6 }, p1: { x: 101.85, y: 74.76 }, p2: { x: 138.65, y: 103.37 }, p3: { x: 130, y: 130 } },
  ];
  const ts = [0.22, 0.46, 0.7];
  const rs = [2.1, 1.5, 0.9];
  const ops = [0.62, 0.44, 0.26];
  const circles: React.ReactNode[] = [];
  arms.forEach((arm, ai) => {
    ts.forEach((t, ti) => {
      const m = 1 - t;
      const x = m*m*m*arm.p0.x + 3*m*m*t*arm.p1.x + 3*m*t*t*arm.p2.x + t*t*t*arm.p3.x;
      const y = m*m*m*arm.p0.y + 3*m*m*t*arm.p1.y + 3*m*t*t*arm.p2.y + t*t*t*arm.p3.y;
      circles.push(
        <circle key={`an${ai}${ti}`} cx={x.toFixed(2)} cy={y.toFixed(2)} r={rs[ti]} fill="#3DDBC8" opacity={ops[ti]} />
      );
    });
  });
  return circles;
}

function sunRays() {
  const cx = 130, cy = 130, ri = 20;
  const ro = [36, 28, 36, 28, 36, 28, 36, 28, 36, 28, 36, 28, 36, 28, 36, 28];
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < 16; i++) {
    const a = ((i * 22.5 - 90) * Math.PI) / 180;
    lines.push(
      <line
        key={`sr${i}`}
        x1={(cx + ri * Math.cos(a)).toFixed(2)}
        y1={(cy + ri * Math.sin(a)).toFixed(2)}
        x2={(cx + ro[i] * Math.cos(a)).toFixed(2)}
        y2={(cy + ro[i] * Math.sin(a)).toFixed(2)}
        stroke="rgba(212,168,71,.55)"
        strokeWidth="0.55"
        strokeLinecap="round"
      />
    );
  }
  return lines;
}

/* ═══════════════════════════════════════
   Particle orbits — deterministic positions
   (no Math.random — prevents hydration mismatch)
   ═══════════════════════════════════════ */
const PARTICLE_RADII = [0.6, 0.9, 0.5, 1.0, 0.7, 0.8, 0.55, 0.95, 0.65, 0.85, 0.5, 0.9, 0.7, 0.8, 0.6, 0.75];
const PARTICLE_OPS   = [0.7, 0.5, 0.9, 0.6, 0.8, 0.55, 0.75, 0.65, 0.85, 0.5, 0.7, 0.6, 0.9, 0.55, 0.8, 0.7];

function particleOrbit(radius: number, count: number, speed: number, direction: 'rcw' | 'rccw', opacity: number) {
  const cx = 130, cy = 130;
  const particles: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const a = ((i * (360 / count) - 90) * Math.PI) / 180;
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    particles.push(
      <circle
        key={`p${radius}-${i}`}
        cx={x.toFixed(2)} cy={y.toFixed(2)} r={PARTICLE_RADII[i % 16]}
        fill={i % 3 === 0 ? '#3DDBC8' : i % 3 === 1 ? '#C8922A' : '#F0D070'}
        opacity={opacity * PARTICLE_OPS[i % 16]}
      />
    );
  }
  return (
    <g style={{
      transformOrigin: '130px 130px',
      animation: `${direction} ${speed}s linear infinite`,
    }}>
      {particles}
    </g>
  );
}

export default function Logo({ size = "nav", animate = true, className = "" }: LogoProps) {
  const sizeMap = { hero: "clamp(220px,34vw,380px)", nav: "32px", inline: "100px" };
  const px = sizeMap[size];
  const isHero = size === "hero";

  return (
    <div
      className={`${className}`}
      style={{ width: px, aspectRatio: "1", contain: 'layout style paint' }}
    >
      <svg
        viewBox="0 0 260 260"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="MANTHANA — five spiral arms churning to the golden Amrita"
        style={{ display: "block", width: "100%", height: "100%" }}
      >
        <defs>
          {/* Five arm gradients: teal-aqua tip → rich gold → luminous gold core */}
          <linearGradient id="ag1" x1="130" y1="35" x2="130" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3DDBC8" stopOpacity=".96" />
            <stop offset="48%" stopColor="#C8922A" />
            <stop offset="100%" stopColor="#F0D070" />
          </linearGradient>
          <linearGradient id="ag2" x1="220.4" y1="100.6" x2="130" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3DDBC8" stopOpacity=".96" />
            <stop offset="48%" stopColor="#C8922A" />
            <stop offset="100%" stopColor="#F0D070" />
          </linearGradient>
          <linearGradient id="ag3" x1="185.8" y1="206.9" x2="130" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3DDBC8" stopOpacity=".96" />
            <stop offset="48%" stopColor="#C8922A" />
            <stop offset="100%" stopColor="#F0D070" />
          </linearGradient>
          <linearGradient id="ag4" x1="74.2" y1="206.9" x2="130" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3DDBC8" stopOpacity=".96" />
            <stop offset="48%" stopColor="#C8922A" />
            <stop offset="100%" stopColor="#F0D070" />
          </linearGradient>
          <linearGradient id="ag5" x1="39.6" y1="100.6" x2="130" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3DDBC8" stopOpacity=".96" />
            <stop offset="48%" stopColor="#C8922A" />
            <stop offset="100%" stopColor="#F0D070" />
          </linearGradient>

          {/* White-hot core → molten gold → void */}
          <radialGradient id="crg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="12%" stopColor="#FFFBE0" />
            <stop offset="33%" stopColor="#F8C94A" />
            <stop offset="62%" stopColor="#C0880A" stopOpacity=".66" />
            <stop offset="100%" stopColor="#7A5000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="coh" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D4A847" stopOpacity=".24" />
            <stop offset="100%" stopColor="#D4A847" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="amb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00C4B0" stopOpacity=".032" />
            <stop offset="55%" stopColor="#C8922A" stopOpacity=".024" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Arm glow */}
          <filter id="fHalo" x="-75%" y="-75%" width="250%" height="250%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="b" />
            <feColorMatrix in="b" type="matrix" values=".08 .35 .5 0 .008  .42 .88 .68 0 .06  .28 .76 .88 0 .036  0 0 0 .42 0" result="c" />
            <feMerge><feMergeNode in="c" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Core bloom */}
          <filter id="fCore" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b2" />
            <feMerge><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Tip bloom */}
          <filter id="fTip" x="-500%" y="-500%" width="1100%" height="1100%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
            <feColorMatrix in="b" type="matrix" values="0 .18 .55 0 0  .35 .92 .68 0 .07  .28 .88 .88 0 .055  0 0 0 .68 0" result="c" />
            <feMerge><feMergeNode in="c" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Ring soft */}
          <filter id="fRing"><feGaussianBlur in="SourceGraphic" stdDeviation=".7" /></filter>
          {/* Energy pulse — radiating rings */}
          <radialGradient id="epg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C8922A" stopOpacity="0" />
            <stop offset="85%" stopColor="#C8922A" stopOpacity=".15" />
            <stop offset="100%" stopColor="#C8922A" stopOpacity="0" />
          </radialGradient>
          {/* Aurora shimmer gradient — static, no animate */}
          <linearGradient id="aurora" x1="0" y1="0" x2="260" y2="260" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3DDBC8" stopOpacity=".06" />
            <stop offset="50%" stopColor="#C8922A" stopOpacity=".05" />
            <stop offset="100%" stopColor="#6E44FF" stopOpacity=".04" />
          </linearGradient>
        </defs>

        {/* Aurora shimmer field — no boxy edges */}
        <circle cx="130" cy="130" r="126" fill="url(#aurora)" />
        {/* Ambient light field */}
        <circle cx="130" cy="130" r="128" fill="url(#amb)" />

        {/* ═══ ENERGY PULSE RINGS — sonar-like expansion from center ═══ */}
        {isHero && animate && [80, 100, 120].map((r, i) => (
          <circle
            key={`ep${i}`}
            cx="130" cy="130" r={r}
            fill="none" stroke="url(#epg)"
            strokeWidth=".6"
            opacity="0"
            style={{
              transformOrigin: '130px 130px',
              animation: `energyPulse 4s ${i * 1.3}s ease-out infinite`,
            }}
          />
        ))}

        {/* ═══ PARTICLE ORBITS — 3 layers of floating motes ═══ */}
        {isHero && animate && (
          <>
            {particleOrbit(120, 16, 40, 'rccw', 0.25)}
            {particleOrbit(85, 12, 28, 'rcw', 0.35)}
            {particleOrbit(55, 8, 18, 'rccw', 0.45)}
          </>
        )}

        {/* Outer tick ring — 60 ticks, CCW 95s */}
        <g style={{ transformOrigin: "130px 130px", animation: "rccw 95s linear infinite" }}>
          {outerTicks()}
        </g>
        {/* Outer structural ring */}
        <circle cx="130" cy="130" r="112.5" fill="none" stroke="rgba(200,146,42,.12)" strokeWidth=".55" filter="url(#fRing)" />
        {/* Outer orbit dash CW 52s */}
        <circle cx="130" cy="130" r="101" fill="none" stroke="rgba(0,196,176,.16)" strokeWidth=".72" strokeDasharray="5 12"
          style={{ transformOrigin: "130px 130px", animation: "rcw 52s linear infinite" }} />

        {/* Inner compass ring — 24 ticks, CW 60s */}
        <g style={{ transformOrigin: "130px 130px", animation: "rcw 60s linear infinite" }}>
          {innerTicks()}
        </g>

        {/* Mid boundary ring */}
        <circle cx="130" cy="130" r="59" fill="none" stroke="rgba(212,168,71,.07)" strokeWidth=".5" strokeDasharray="2 7.5" />

        {/* Ghost spokes */}
        <g opacity=".038" stroke="#FFF" strokeWidth=".4">
          <line x1="130" y1="35" x2="130" y2="130" />
          <line x1="220.4" y1="100.6" x2="130" y2="130" />
          <line x1="185.8" y1="206.9" x2="130" y2="130" />
          <line x1="74.2" y1="206.9" x2="130" y2="130" />
          <line x1="39.6" y1="100.6" x2="130" y2="130" />
        </g>

        {/* Secondary echo arms — very slow CW drift (35s) */}
        <g opacity=".14" style={{ transformOrigin: "130px 130px", animation: "rcw 35s linear infinite" }}>
          <path d="M130,35 C184,78 170,127 130,130" fill="none" stroke="url(#ag1)" strokeWidth=".45" strokeLinecap="round" />
          <path d="M220.4,100.6 C184,170 140,165 130,130" fill="none" stroke="url(#ag2)" strokeWidth=".45" strokeLinecap="round" />
          <path d="M185.8,206.9 C113,200 100,151 130,130" fill="none" stroke="url(#ag3)" strokeWidth=".45" strokeLinecap="round" />
          <path d="M74.2,206.9 C59,133 100,107 130,130" fill="none" stroke="url(#ag4)" strokeWidth=".45" strokeLinecap="round" />
          <path d="M39.6,100.6 C108,64 143,94 130,130" fill="none" stroke="url(#ag5)" strokeWidth=".45" strokeLinecap="round" />
        </g>

        {/* ARM HALOS — CCW stir (16s) — NO FILTER on rotating group */}
        <g opacity=".18" style={{ transformOrigin: "130px 130px", animation: "rccw 16s linear infinite" }}>
          <path d="M130,35 C173.84,86.16 158,130 130,130" fill="none" stroke="#3DDBC8" strokeWidth="5" strokeLinecap="round" />
          <path d="M220.4,100.6 C185.24,158.15 138.65,156.63 130,130" fill="none" stroke="#3DDBC8" strokeWidth="5" strokeLinecap="round" />
          <path d="M185.8,206.9 C120.36,191.24 107.35,146.47 130,130" fill="none" stroke="#3DDBC8" strokeWidth="5" strokeLinecap="round" />
          <path d="M74.2,206.9 C68.76,139.64 107.35,113.53 130,130" fill="none" stroke="#3DDBC8" strokeWidth="5" strokeLinecap="round" />
          <path d="M39.6,100.6 C101.85,74.76 138.65,103.37 130,130" fill="none" stroke="#3DDBC8" strokeWidth="5" strokeLinecap="round" />
        </g>

        {/* MAIN SPIRAL ARMS — CW stir (22s) — NO FILTER on rotating group */}
        <g style={{ transformOrigin: "130px 130px", animation: "rcw 22s linear infinite" }}>
          <path d="M130,35 C173.84,86.16 158,130 130,130" fill="none" stroke="url(#ag1)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M220.4,100.6 C185.24,158.15 138.65,156.63 130,130" fill="none" stroke="url(#ag2)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M185.8,206.9 C120.36,191.24 107.35,146.47 130,130" fill="none" stroke="url(#ag3)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M74.2,206.9 C68.76,139.64 107.35,113.53 130,130" fill="none" stroke="url(#ag4)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M39.6,100.6 C101.85,74.76 138.65,103.37 130,130" fill="none" stroke="url(#ag5)" strokeWidth="2.2" strokeLinecap="round" />
        </g>

        {/* TIP NODES — NO FILTER, just glow color */}
        <g style={{ animation: "tblink 4s ease-in-out infinite" }}>
          <circle cx="130" cy="35" r="3.6" fill="#7FFFD4" />
          <circle cx="220.4" cy="100.6" r="3.6" fill="#7FFFD4" />
          <circle cx="185.8" cy="206.9" r="3.6" fill="#7FFFD4" />
          <circle cx="74.2" cy="206.9" r="3.6" fill="#7FFFD4" />
          <circle cx="39.6" cy="100.6" r="3.6" fill="#7FFFD4" />
        </g>

        {/* Bezier midpoint nodes — CCW drift (30s) */}
        <g opacity=".64" style={{ transformOrigin: "130px 130px", animation: "rccw 30s linear infinite" }}>{armNodes()}</g>

        {/* Sun ray lines emanating from core */}
        <g opacity=".28">{sunRays()}</g>

        {/* Outer pentagon — sacred enclosure */}
        <polygon points="130,100 158.53,120.73 147.63,154.27 112.37,154.27 101.47,120.73"
          fill="none" stroke="rgba(212,168,71,.22)" strokeWidth=".68" />

        {/* 8 Lotus petals — inner mandala */}
        <g opacity=".09" fill="none" stroke="rgba(212,168,71,1)" strokeWidth=".6">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
            <path key={r} d="M130,120 C140,111 142,96 130,86 C118,96 120,111 130,120Z" transform={`rotate(${r},130,130)`} />
          ))}
        </g>

        {/* Star of David / hexagram — union of ancient and modern */}
        <g opacity=".14" fill="none" stroke="rgba(0,196,176,1)" strokeWidth=".64">
          <polygon points="130,106 151.65,143.5 108.35,143.5" />
          <polygon points="130,154 151.65,116.5 108.35,116.5" />
        </g>

        {/* Inner dashed spin ring CCW 25s */}
        <circle cx="130" cy="130" r="34.5" fill="none"
          stroke="rgba(212,168,71,.18)" strokeWidth=".66" strokeDasharray="3 8.5"
          style={{ transformOrigin: "130px 130px", animation: "rccw 25s linear infinite" }} />

        {/* Pearl ring: 8 pearls CW 18s at r=50 */}
        <g style={{ transformOrigin: "130px 130px", animation: "rcw 18s linear infinite" }} opacity=".50">
          <circle cx="130" cy="80" r="1.6" fill="rgba(212,168,71,.95)" />
          <circle cx="165.36" cy="94.64" r="1.6" fill="rgba(212,168,71,.95)" />
          <circle cx="180" cy="130" r="1.6" fill="rgba(212,168,71,.95)" />
          <circle cx="165.36" cy="165.36" r="1.6" fill="rgba(212,168,71,.95)" />
          <circle cx="130" cy="180" r="1.6" fill="rgba(212,168,71,.95)" />
          <circle cx="94.64" cy="165.36" r="1.6" fill="rgba(212,168,71,.95)" />
          <circle cx="80" cy="130" r="1.6" fill="rgba(212,168,71,.95)" />
          <circle cx="94.64" cy="94.64" r="1.6" fill="rgba(212,168,71,.95)" />
        </g>

        {/* Pearl ring: 5 pearls CCW 13s at r=17 */}
        <g style={{ transformOrigin: "130px 130px", animation: "rccw 13s linear infinite" }} opacity=".68">
          <circle cx="130" cy="113" r="1.3" fill="rgba(212,168,71,1)" />
          <circle cx="146.18" cy="124.75" r="1.3" fill="rgba(212,168,71,1)" />
          <circle cx="139.99" cy="143.76" r="1.3" fill="rgba(212,168,71,1)" />
          <circle cx="120.01" cy="143.76" r="1.3" fill="rgba(212,168,71,1)" />
          <circle cx="113.82" cy="124.75" r="1.3" fill="rgba(212,168,71,1)" />
        </g>

        {/* Core — HEARTBEAT outer halo (lub-dub rhythm, 1.2s) */}
        <circle cx="130" cy="130" r="30" fill="url(#coh)"
          style={{ transformOrigin: "130px 130px", animation: "heartbeat-outer 1.2s ease-in-out infinite" }} />
        {/* Core — HEARTBEAT mid (offset by .06s for the dub) */}
        <circle cx="130" cy="130" r="18" fill="url(#crg)"
          style={{ transformOrigin: "130px 130px", animation: "heartbeat 1.2s .06s ease-in-out infinite" }} />
        {/* Core bright — bloom synced to heartbeat */}
        <circle cx="130" cy="130" r="12" fill="url(#crg)" filter="url(#fCore)"
          style={{ transformOrigin: "130px 130px", animation: "heartbeat 1.2s .03s ease-in-out infinite" }} />

        {/* ═══ HYPNOTIC CORE — layered light rings ═══ */}
        {isHero && animate && (
          <>
            {/* Breathing light ring 1 */}
            <circle cx="130" cy="130" r="7" fill="none" stroke="#F8C94A" strokeWidth=".4"
              opacity=".2" style={{ transformOrigin: '130px 130px', animation: 'pulse 3s ease-in-out infinite' }} />
            {/* Breathing light ring 2 */}
            <circle cx="130" cy="130" r="9.5" fill="none" stroke="#3DDBC8" strokeWidth=".3"
              opacity=".12" style={{ transformOrigin: '130px 130px', animation: 'pulse 4s 1s ease-in-out infinite' }} />
          </>
        )}

        {/* The Amrita — pure extracted nectar */}
        <circle cx="130" cy="130" r="4.4" fill="#FFF8D8" />
        <circle cx="130" cy="130" r="2.1" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
