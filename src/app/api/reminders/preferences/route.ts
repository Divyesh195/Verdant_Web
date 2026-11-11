import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { body, failure, ownerId } from "@/lib/events/http";
import { InputError, object, text } from "@/lib/events/input";
import { emailConfigured, pushConfigured, validPushEndpoint } from "@/lib/reminders/delivery";

export const runtime = "nodejs";
export async function GET() {
  try {
    const userId = await ownerId();
    const preferences = await prisma.emailPreference.findUnique({ where: { userId } });
    return NextResponse.json({ preferences, emailConfigured: emailConfigured(), pushConfigured: pushConfigured(), publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const userId = await ownerId();
    const input = object(await body(request));
    if (input.action === "email") {
      if (typeof input.emailEnabled !== "boolean") throw new InputError("Choose whether to enable email.");
      const hour = (v: unknown) => v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23);
      const start = input.quietHoursStart ?? null, end = input.quietHoursEnd ?? null;
      if (!hour(start) || !hour(end) || (start === null) !== (end === null)) throw new InputError("Quiet hours need both start and end hours, 0–23.");
      const data = { emailEnabled: input.emailEnabled, quietHoursStart: start as number | null, quietHoursEnd: end as number | null };
      await prisma.emailPreference.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    } else {
      const endpoint = text(input.endpoint, "Push endpoint", 4096, true)!;
      if (!validPushEndpoint(endpoint)) throw new InputError("Unsupported browser push service.");
      if (input.action === "unsubscribe") {
        await prisma.pushSubscription.updateMany({ where: { userId, endpoint }, data: { isActive: false } });
      } else if (input.action === "subscribe") {
        if (!pushConfigured()) throw new InputError("Browser push is not configured on the server.");
        const keys = object(input.keys);
        const p256dh = text(keys.p256dh, "Push public key", 200, true)!;
        const auth = text(keys.auth, "Push auth key", 100, true)!;
        if (!/^[A-Za-z0-9_-]+={0,2}$/.test(p256dh) || !/^[A-Za-z0-9_-]+={0,2}$/.test(auth) || Buffer.from(p256dh, "base64url").length !== 65 || Buffer.from(auth, "base64url").length !== 16) throw new InputError("Invalid push subscription keys.");
        const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
        if (existing && existing.userId !== userId) {
          // The browser can be shared by accounts; move only with proof of both subscription keys.
          if (existing.p256dh !== p256dh || existing.auth !== auth) throw new InputError("Subscription belongs to another account.");
        }
        if (await prisma.pushSubscription.count({ where: { userId, isActive: true } }) >= 10 && !existing?.isActive) throw new InputError("At most 10 browser subscriptions are allowed.");
        await prisma.pushSubscription.upsert({ where: { endpoint }, create: { userId, endpoint, p256dh, auth }, update: { userId, p256dh, auth, isActive: true } });
      } else throw new InputError("Unknown preference action.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
