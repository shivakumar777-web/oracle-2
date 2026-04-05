import ThemeProvider from "@/components/analyse/shared/ThemeProvider";

/**
 * Radiology / imaging module — full-width layout (no host sidebar).
 * Theme tokens match Manthana Radiologist Copilot (CSS in analyse-design-system.css).
 */
export default function AnalyseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
