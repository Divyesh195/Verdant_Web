import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { syncSupabaseUser } from "@/lib/supabase/sync-user";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncSupabaseUser(user);

  return NextResponse.json({ ok: true });
}
