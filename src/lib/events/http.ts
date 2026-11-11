import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { syncSupabaseUser } from "@/lib/supabase/sync-user";
import { InputError } from "./input";

export async function ownerId() {
  const { data: { user }, error } = await (await createClient()).auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  let owner = await prisma.user.findUnique({ where: { id: user.id } });
  if (!owner) owner = await syncSupabaseUser(user);
  if (!owner.isActive) throw new Error("UNAUTHORIZED");
  return user.id;
}
export async function body(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > 100_000) throw new InputError("Request is too large.");
  try { return JSON.parse(raw); } catch { throw new InputError("Invalid JSON."); }
}
export function failure(error: unknown) {
  if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  console.error("Events request failed", error instanceof Error ? error.name : "Unknown error");
  return NextResponse.json({ error: "Unable to save events. Check the database migration and try again." }, { status: 500 });
}
