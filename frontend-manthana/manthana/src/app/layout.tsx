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
            __html: `(function(){try{var t=localStorage.getItem("manthana_theme");if(t&&["default","blackhole","clinical"].indexOf(t)!==-1){if(t==="clinical"&&window.innerWidth<=1024)t="default";document.documentElement.dataset.theme=t}}catch(e){}})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
