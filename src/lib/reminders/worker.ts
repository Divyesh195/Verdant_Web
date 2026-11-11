import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getNextRunAt, resolveReminderRecipient, shouldAutoComplete } from "./schedule";
import { isQuietHour, sendEmail, sendPush } from "./delivery";

async function autoComplete(now: Date, deadline: number) {
  const due = await prisma.event.findMany({ where: { status: "ACTIVE", autoCompleteOnDue: true, dueAt: { lte: now } }, select: { id: true }, take: 100 });
  let completed = 0;
  for (const { id } of due) {
    if (Date.now() > deadline - 20_000) break;
    completed += await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${id} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id } });
      if (!event || !shouldAutoComplete(event, now)) return 0;
      if (await tx.reminder.count({ where: { eventId: id, lockedUntil: { gt: now } } })) return 0;
      await tx.event.update({ where: { id }, data: { status: "COMPLETED", completedAt: now, completionSource: "AUTOMATIC" } });
      await tx.reminder.updateMany({ where: { eventId: id }, data: { enabled: false, nextRunAt: null } });
      await tx.reminderDelivery.updateMany({ where: { reminder: { eventId: id }, status: { in: ["PENDING", "FAILED"] } }, data: { status: "CANCELLED", error: "Event automatically completed" } });
      return 1;
    });
  }
  return completed;
}

async function processReminder(id: string, eventId: string, deadline: number) {
  const now = new Date(), token = randomUUID();
  const reminder = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event || event.status !== "ACTIVE" || shouldAutoComplete(event, now)) return null;
    const claimed = await tx.reminder.updateMany({ where: { id, enabled: true, nextRunAt: { lte: now }, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] }, data: { lockToken: token, lockedUntil: new Date(Date.now() + 120_000) } });
    if (!claimed.count) return null;
    return tx.reminder.findUnique({ where: { id }, include: { event: true } });
  });
  if (!reminder?.nextRunAt) return false;
  const scheduledFor = reminder.nextRunAt;
  try {
    const owner = await resolveReminderRecipient(reminder.event.userId, userId => prisma.user.findUnique({ where: { id: userId } }));
    if (!owner) {
      await prisma.reminder.update({ where: { id }, data: { enabled: false, nextRunAt: null } });
      await prisma.reminderDelivery.updateMany({ where: { reminderId: id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "CANCELLED", error: "Recipient inactive or missing" } });
      return true;
    }
    const preferences = await prisma.emailPreference.findUnique({ where: { userId: owner.id } });
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: owner.id, isActive: true }, take: 10 });
    // Freeze recipients for this occurrence, so a retry never adds a newly registered device.
    if (!await prisma.reminderDelivery.count({ where: { reminderId: id, scheduledFor } })) {
      const targets = reminder.channels.flatMap<{ channel: "EMAIL" | "WEB_PUSH"; recipientKey: string; status: "PENDING" | "CANCELLED"; error: string | null }>(channel => channel === "EMAIL"
        ? [{ channel, recipientKey: "EMAIL", status: preferences?.emailEnabled === false ? "CANCELLED" as const : "PENDING" as const, error: preferences?.emailEnabled === false ? "Email disabled" : null }]
        : subscriptions.length ? subscriptions.map(s => ({ channel, recipientKey: s.id, status: "PENDING" as const, error: null }))
          : [{ channel, recipientKey: "NO_DEVICE", status: "CANCELLED" as const, error: "No active browser subscription" }]);
      await prisma.reminderDelivery.createMany({ data: targets.map(target => ({ ...target, reminderId: id, scheduledFor })), skipDuplicates: true });
    }
    const deliveries = await prisma.reminderDelivery.findMany({ where: { reminderId: id, scheduledFor, status: { in: ["PENDING", "FAILED"] } } });
    const message = [reminder.event.title, reminder.event.notes,
      reminder.event.dueAt ? `Deadline: ${reminder.event.dueAt.toLocaleString("en-IN", { timeZone: reminder.timeZone })} (${reminder.timeZone})` : null,
      reminder.event.location, "Open your Verdant events page to view or complete this event."].filter(Boolean).join("\n\n");
    for (const delivery of deliveries) {
      if (Date.now() > deadline - 20_000) return false;
      if (delivery.nextAttemptAt && delivery.nextAttemptAt > new Date()) continue;
      const current = await prisma.event.findUnique({ where: { id: eventId } });
      if (!current || current.status !== "ACTIVE" || shouldAutoComplete(current, new Date())) return false;
      const held = await prisma.reminder.updateMany({ where: { id, lockToken: token }, data: { lockedUntil: new Date(Date.now() + 120_000) } });
      if (!held.count) return false;
      const emailPrefs = delivery.channel === "EMAIL" ? await prisma.emailPreference.findUnique({ where: { userId: owner.id } }) : null;
      if (emailPrefs?.emailEnabled === false) {
        await prisma.reminderDelivery.update({ where: { id: delivery.id }, data: { status: "CANCELLED", error: "Email disabled" } });
        continue;
      }
      if (delivery.channel === "EMAIL" && isQuietHour(emailPrefs?.quietHoursStart, emailPrefs?.quietHoursEnd, reminder.timeZone, new Date())) {
        await prisma.reminderDelivery.update({ where: { id: delivery.id }, data: { nextAttemptAt: new Date(Date.now() + 15 * 60_000) } });
        continue;
      }
      const subscription = delivery.channel === "WEB_PUSH" ? await prisma.pushSubscription.findFirst({ where: { id: delivery.recipientKey, userId: owner.id, isActive: true } }) : null;
      if (delivery.channel === "WEB_PUSH" && !subscription) {
        await prisma.reminderDelivery.update({ where: { id: delivery.id }, data: { status: "CANCELLED", error: "Browser subscription removed" } });
        continue;
      }
      try {
        if (delivery.channel === "EMAIL") await sendEmail(owner.email, reminder.event.title, message, delivery.id);
        else await sendPush(subscription!, reminder.event.title, message, delivery.id);
        const sentAt = new Date();
        await prisma.$transaction([
          prisma.reminderDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", sentAt, attemptCount: { increment: 1 }, error: null, nextAttemptAt: null } }),
          prisma.reminder.update({ where: { id }, data: { lastSentAt: sentAt } }),
        ]);
      } catch (error) {
        const code = error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : 0;
        const expired = delivery.channel === "WEB_PUSH" && [404, 410].includes(code);
        if (expired && subscription) await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { isActive: false } });
        const attempts = delivery.attemptCount + 1;
        await prisma.reminderDelivery.update({ where: { id: delivery.id }, data: {
          status: expired || attempts >= 5 ? "CANCELLED" : "FAILED", attemptCount: attempts,
          error: expired ? "Push subscription expired" : attempts >= 5 ? "Delivery failed after 5 attempts; check sender settings" : "Delivery failed; retry scheduled",
          nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60_000),
        } });
      }
    }
    if (await prisma.reminderDelivery.count({ where: { reminderId: id, scheduledFor, status: { in: ["PENDING", "FAILED"] } } })) return false;
    const rule = reminder.rule as { interval?: number; weekdays?: number[] } | null;
    const nextRunAt = getNextRunAt({ ...reminder, rule, lastScheduledFor: scheduledFor }, "ACTIVE", new Date());
    await prisma.reminder.updateMany({ where: { id, lockToken: token }, data: { lastScheduledFor: scheduledFor, nextRunAt, enabled: Boolean(nextRunAt) } });
    return true;
  } finally {
    await prisma.reminder.updateMany({ where: { id, lockToken: token }, data: { lockToken: null, lockedUntil: null } });
  }
}

export async function runReminders() {
  const deadline = Date.now() + 50_000;
  const completed = await autoComplete(new Date(), deadline);
  const due = await prisma.reminder.findMany({ where: { enabled: true, nextRunAt: { lte: new Date() }, event: { status: "ACTIVE" }, OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }] }, orderBy: { updatedAt: "asc" }, select: { id: true, eventId: true }, take: 50 });
  let processed = 0, errors = 0;
  for (const reminder of due) {
    if (Date.now() > deadline - 20_000) break;
    try { if (await processReminder(reminder.id, reminder.eventId, deadline)) processed++; }
    catch { errors++; }
  }
  return { autoCompleted: completed, processed, errors };
}
