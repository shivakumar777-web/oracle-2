import ThemeProvider from "@/components/analyse/shared/ThemeProvider";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canAccessLabs, profileForLabsAccess } from "@/lib/product-access";
import { redirect } from "next/navigation";

/**
 * Radiology / imaging module — full-width layout (no host sidebar).
 * Theme tokens match Manthana Radiologist Copilot (CSS in analyse-design-system.css).
 * Labs: active PRO / Premium, or signed-in free tier with lifetime trial scans remaining (`profiles`).
 */
export default async function AnalyseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?callbackUrl=/analyse");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_plan, labs_free_trial_used")
    .eq("id", user.id)
    .single();
  if (!canAccessLabs(profileForLabsAccess(profile))) {
    redirect("/?labsLocked=1");
  }

  return <ThemeProvider>{children}</ThemeProvider>;
}
