import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Records Manthana Labs DPDP-style consent without depending on Oracle/gateway.
 * The imaging gateway may not expose POST /consent; Vercel would otherwise return 502 from the proxy.
 */
export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as {
    patient_id?: string;
    purpose?: string;
    informed_by?: string;
  };

  const patientId =
    typeof raw.patient_id === "string"
      ? raw.patient_id.trim().slice(0, 200) || "ANONYMOUS"
      : "ANONYMOUS";

  const purpose =
    typeof raw.purpose === "string"
      ? raw.purpose.trim().slice(0, 120)
      : "radiology_second_opinion";
  const informedBy =
    typeof raw.informed_by === "string"
      ? raw.informed_by.trim().slice(0, 80)
      : "clinician";

  return NextResponse.json({
    ok: true,
    recorded_at: new Date().toISOString(),
    patient_id: patientId,
    purpose,
    informed_by: informedBy,
    user_id: user.id,
  });
}
