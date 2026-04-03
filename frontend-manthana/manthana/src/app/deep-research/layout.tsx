import type { Metadata } from "next";
import { DomainSourcesProvider } from "@/contexts/DomainSourcesContext";

export const metadata: Metadata = {
  title: "Deep Research — Multi-system medicine synthesis | Manthana",
  description:
    "Clinical & traditional research synthesis for multi-system medicine. Not a general web oracle — structured evidence across Allopathy, Ayurveda, Homeopathy, Siddha, and Unani.",
  openGraph: {
    title: "Manthana Deep Research",
    description:
      "Clinical & traditional research synthesis for multi-system medicine — not generic web search.",
  },
};

export default function DeepResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DomainSourcesProvider>{children}</DomainSourcesProvider>;
}
