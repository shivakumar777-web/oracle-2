import type { Metadata, Viewport } from "next";
import {
  Cormorant_Garamond,
  Space_Mono,
  Lora,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
  preload: true,
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
  preload: false, // Only used in specific components
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
  preload: false, // Secondary font, lazy loaded
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false, // Only used for code blocks
});

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icons/icon.svg",
    apple: [{ url: "/icons/icon-192.png", sizes: "180x180", type: "image/png" }],
  },
  title: "MANTHANA — Cosmic Medical Intelligence",
  description:
    "MANTHANA churns five oceans of medicine — Ayurveda, Allopathy, Homeopathy, Siddha, and Unani — extracting Amrita: pure, verified medical knowledge.",
  keywords: [
    "medical AI", "Ayurveda", "Allopathy", "radiology AI", "drug interactions",
    "clinical research", "medical intelligence", "Manthana", "Samudra Manthan",
  ],
  authors: [{ name: "MANTHANA Medical Intelligence" }],
  robots: "noindex, nofollow",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MANTHANA",
  },
  openGraph: {
    type: "website",
    title: "MANTHANA — Cosmic Medical Intelligence",
    description: "Where ancient wisdom meets modern medicine.",
    siteName: "MANTHANA",
  },
};

export const viewport: Viewport = {
  themeColor: "#020610",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${cormorant.variable} ${spaceMono.variable} ${lora.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("manthana_theme");var st=window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches;if(t&&["default","blackhole","clinical"].indexOf(t)!==-1){if(t==="clinical"&&window.innerWidth<=1024&&!st)t="default";document.documentElement.dataset.theme=t}}catch(e){}})()`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof navigator==="undefined"||!navigator.serviceWorker)return;var h=location.hostname;var ok=location.protocol==="https:"||h==="localhost"||h==="127.0.0.1";if(!ok)return;navigator.serviceWorker.register("/sw.js").catch(function(){})})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
