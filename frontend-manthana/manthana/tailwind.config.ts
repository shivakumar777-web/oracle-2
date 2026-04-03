import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cosmic blacks
        cosmic: {
          0: "#000000",
          1: "#020610",
          2: "#04080F",
        },
        // Gold palette
        gold: {
          s: "#6E4010",
          d: "#A87830",
          DEFAULT: "#C8922A",
          m: "#D4A847",
          h: "#ECC967",
          p: "#F7E4A0",
          x: "#FFFBE8",
        },
        // Teal palette
        teal: {
          d: "#005A54",
          DEFAULT: "#009B8E",
          m: "#00C4B0",
          h: "#3DDBC8",
          p: "#A0EEE6",
        },
        // Cream / White
        cream: "#F5F0E8",
        "cream-d": "rgba(245,240,232,0.48)",
        "cream-f": "rgba(245,240,232,0.16)",
      },
      fontFamily: {
        ui: ["Optima", "Candara", "Century Gothic", "Verdana", "sans-serif"],
        body: [
          "Palatino Linotype",
          "Book Antiqua",
          "Palatino",
          "Georgia",
          "serif",
        ],
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        rcw: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        rccw: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(-360deg)" },
        },
        pulse: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        glow: {
          "0%, 100%": { filter: "drop-shadow(0 0 2px rgba(200,146,42,.35))" },
          "50%": { filter: "drop-shadow(0 0 12px rgba(200,146,42,.65))" },
        },
        tblink: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(26px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        scandash: {
          "0%": { strokeDashoffset: "300" },
          "100%": { strokeDashoffset: "0" },
        },
        fi: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        rule: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        bgdot: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "40px 40px" },
        },
        scanline: {
          "0%": { top: "0%" },
          "100%": { top: "100%" },
        },
        "particle-rise": {
          "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(-80px) scale(0.3)" },
        },
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        rcw: "rcw 20s linear infinite",
        rccw: "rccw 25s linear infinite",
        pulse: "pulse 3s ease-in-out infinite",
        glow: "glow 3s ease-in-out infinite",
        tblink: "tblink 2s ease-in-out infinite",
        rise: "rise 0.6s ease-out forwards",
        shimmer: "shimmer 3s ease-in-out infinite",
        scandash: "scandash 2s linear infinite",
        fi: "fi 0.8s ease-out forwards",
        rule: "rule 1s ease-out forwards",
        bgdot: "bgdot 8s linear infinite",
        scanline: "scanline 2s ease-in-out infinite",
        "particle-rise": "particle-rise 2s ease-out forwards",
      },
      backgroundImage: {
        "gold-gradient":
          "linear-gradient(135deg, #C8922A 0%, #ECC967 50%, #C8922A 100%)",
        "gold-shimmer":
          "linear-gradient(90deg, transparent 0%, #C8922A 20%, #ECC967 50%, #C8922A 80%, transparent 100%)",
        "cosmic-radial":
          "radial-gradient(ellipse at 50% 50%, #0a183a 0%, #020610 60%, #000 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
