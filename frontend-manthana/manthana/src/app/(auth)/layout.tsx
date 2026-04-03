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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#020610]">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
