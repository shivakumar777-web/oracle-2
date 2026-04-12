import MobilePwaInstallBanner from "@/components/MobilePwaInstallBanner";

/**
 * Auth layout — sign-in / sign-up pages
 * Centered card on cosmic background
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-[#020610]">
      <MobilePwaInstallBanner />
      <div className="w-full max-w-md relative z-10">{children}</div>
    </div>
  );
}
