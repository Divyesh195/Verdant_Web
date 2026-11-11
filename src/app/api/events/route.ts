import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { body, failure, ownerId } from "@/lib/events/http";
import { object, parseEvent, text } from "@/lib/events/input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const userId = await ownerId();
    const events = await prisma.event.findMany({ where: { userId }, include: { reminders: { where: { retired: false }, include: { deliveries: { orderBy: { scheduledFor: "desc" }, take: 3, select: { channel: true, status: true, error: true } } } }, nextEvent: { select: { id: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
    return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const userId = await ownerId();
    const input = object(await body(request));
    const requestKey = text(input.requestKey, "Request key", 100, true)!;
    const existing = await prisma.event.findUnique({ where: { userId_requestKey: { userId, requestKey } } });
    if (existing) return NextResponse.json({ event: existing });
    const { reminders, ...data } = parseEvent(input);
    const event = await prisma.event.upsert({ where: { userId_requestKey: { userId, requestKey } }, update: {},
      create: { ...data, userId, requestKey, reminders: { create: reminders } } });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) { return failure(error); }
}
