import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { body, failure, ownerId } from "@/lib/events/http";
import { date, InputError, object, parseEvent } from "@/lib/events/input";

export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await ownerId();
    const { id } = await params;
    const input = object(await body(request));
    const now = new Date();
    const result = await prisma.$transaction(async tx => {
      // Serialize event mutations and worker completion against the same event row.
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${id} AND "userId" = ${userId}::uuid FOR UPDATE`;
      const event = await tx.event.findFirst({ where: { id, userId }, include: { reminders: { where: { retired: false } }, nextEvent: true } });
      if (!event) throw new InputError("Event not found.");
      if (input.action === "followup") {
        if (event.status !== "COMPLETED") throw new InputError("Complete the event first.");
        if (event.nextEvent) return event.nextEvent;
        const dueAt = date(input.dueAt, "Next deadline");
        if (!dueAt || dueAt <= now) throw new InputError("Choose a future deadline.");
        const shift = dueAt.getTime() - (event.dueAt?.getTime() ?? event.startsAt?.getTime() ?? dueAt.getTime());
        const shifted = (value: Date | null) => value ? new Date(value.getTime() + shift).toISOString() : null;
        const data = parseEvent({ ...event, dueAt: dueAt.toISOString(), startsAt: shifted(event.startsAt), endsAt: shifted(event.endsAt),
          reminders: event.reminders.map(r => ({ ...r, firstRunAt: event.dueAt || event.startsAt ? shifted(r.firstRunAt) : dueAt.toISOString(), repeatUntil: shifted(r.repeatUntil) })) }, now);
        const { reminders, ...fields } = data;
        return tx.event.create({ data: { ...fields, userId, previousEventId: id, reminders: { create: reminders } } });
      }
      if (event.status !== "ACTIVE") {
        if (input.action === "complete" && event.status === "COMPLETED") return event;
        if (input.action === "cancel" && event.status === "CANCELLED") return event;
        throw new InputError("Only active events can be changed.");
      }
      if (event.reminders.some(r => r.lockedUntil && r.lockedUntil > now)) throw new InputError("A reminder is being processed. Try again shortly.");
      if (input.action === "update") {
        const { reminders, ...fields } = parseEvent(input.event, now);
        await tx.reminderDelivery.updateMany({ where: { reminder: { eventId: id }, status: { in: ["PENDING", "FAILED"] } }, data: { status: "CANCELLED", error: "Event rescheduled" } });
        // Retain past delivery records; retire old schedules rather than deleting them.
        await tx.reminder.updateMany({ where: { eventId: id }, data: { enabled: false, retired: true, nextRunAt: null } });
        return tx.event.update({ where: { id }, data: { ...fields, reminders: { create: reminders } } });
      }
      if (input.action !== "complete" && input.action !== "cancel") throw new InputError("Unknown event action.");
      await tx.reminder.updateMany({ where: { eventId: id }, data: { enabled: false, nextRunAt: null } });
      await tx.reminderDelivery.updateMany({ where: { reminder: { eventId: id }, status: { in: ["PENDING", "FAILED"] } }, data: { status: "CANCELLED", error: "Event closed" } });
      return tx.event.update({ where: { id }, data: input.action === "complete" ? { status: "COMPLETED", completedAt: now, completionSource: "MANUAL" } : { status: "CANCELLED" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    return NextResponse.json({ event: result });
  } catch (error) { return failure(error); }
}
