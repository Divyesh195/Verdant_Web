import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const receivedBytes = Buffer.from(provided), expectedBytes = Buffer.from(expected);
  if (!secret || receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await runReminders(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Reminder worker failed. Check the database migration." }, { status: 500 }); }
}
