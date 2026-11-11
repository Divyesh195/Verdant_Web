import { getFirstRunAt, getNextRunAt, type Frequency } from "../reminders/schedule";

export class InputError extends Error {}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Expected an object.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, name: string, max = 200, required = false): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new InputError(`${name} is required.`);
    return null;
  }
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new InputError(`Invalid ${name}.`);
  return value.trim();
}
export function date(value: unknown, name: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) throw new InputError(`${name} needs a timezone.`);
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()) || result.getUTCFullYear() < 1970 || result.getUTCFullYear() > 2200) throw new InputError(`Invalid ${name}.`);
  return result;
}
function boolean(value: unknown, name: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new InputError(`Invalid ${name}.`);
  return value;
}
export function parseEvent(value: unknown, now = new Date()) {
  const input = object(value);
  const startsAt = date(input.startsAt, "Start time");
  const endsAt = date(input.endsAt, "End time");
  const dueAt = date(input.dueAt, "Deadline");
  if (endsAt && (!startsAt || endsAt < startsAt)) throw new InputError("End time must follow a start time.");
  const autoCompleteOnDue = boolean(input.autoCompleteOnDue, "Automatic completion");
  if (autoCompleteOnDue && (!dueAt || dueAt <= now)) throw new InputError("Automatic completion needs a future deadline.");
  const url = text(input.url, "URL", 2000);
  if (url) {
    try { if (!["https:", "http:"].includes(new URL(url).protocol)) throw new Error(); }
    catch { throw new InputError("Use an http or https URL."); }
  }
  const reminderValues = input.reminders ?? [];
  if (!Array.isArray(reminderValues) || reminderValues.length > 10) throw new InputError("Use at most 10 reminders per event.");
  const reminders = reminderValues.map(value => {
    const r = object(value);
    const frequency = r.frequency as Frequency;
    if (!["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(frequency)) throw new InputError("Invalid reminder frequency.");
    const timeZone = text(r.timeZone ?? "Asia/Kolkata", "Timezone", 100, true)!;
    try { new Intl.DateTimeFormat("en", { timeZone }).format(now); }
    catch { throw new InputError("Choose a valid IANA timezone."); }
    if (!Array.isArray(r.channels) || !r.channels.length || r.channels.length > 2 || r.channels.some(c => c !== "EMAIL" && c !== "WEB_PUSH")) throw new InputError("Select email, browser push, or both.");
    const channels = [...new Set(r.channels)] as ("EMAIL" | "WEB_PUSH")[];
    const offsetMinutes = r.offsetMinutes === undefined || r.offsetMinutes === null ? null : r.offsetMinutes;
    if (offsetMinutes !== null && (typeof offsetMinutes !== "number" || !Number.isSafeInteger(offsetMinutes) || Math.abs(offsetMinutes) > 5_256_000)) throw new InputError("Invalid reminder offset.");
    const target = offsetMinutes === null ? null : r.target;
    if (target !== null && !["START", "DUE", "END"].includes(target as string)) throw new InputError("Choose a start, deadline or end target.");
    const targetAt = target === "START" ? startsAt : target === "DUE" ? dueAt : target === "END" ? endsAt : null;
    const rule = object(r.rule ?? {});
    if (Object.keys(rule).some(key => key !== "interval" && key !== "weekdays")) throw new InputError("Unknown recurrence option.");
    const interval = rule.interval ?? 1;
    if (typeof interval !== "number" || !Number.isInteger(interval) || interval < 1 || interval > 100) throw new InputError("Repeat interval must be 1–100.");
    const weekdays = rule.weekdays;
    if (weekdays !== undefined && (frequency !== "WEEKLY" || !Array.isArray(weekdays) || !weekdays.length || weekdays.length > 7 || weekdays.some(d => typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > 6))) throw new InputError("Invalid weekly days.");
    const normalizedRule = { interval, ...(weekdays ? { weekdays: [...new Set(weekdays as number[])].sort() } : {}) };
    let firstRunAt: Date;
    let nextRunAt: Date | null;
    const repeatUntil = date(r.repeatUntil, "Repeat until");
    try {
      firstRunAt = getFirstRunAt(targetAt, offsetMinutes as number | null, date(r.firstRunAt, "Reminder time") ?? undefined);
      if (repeatUntil && repeatUntil < firstRunAt) throw new Error("Repeat end must follow the first reminder.");
      nextRunAt = getNextRunAt({ firstRunAt, frequency, timeZone, rule: normalizedRule, repeatUntil, enabled: true }, "ACTIVE", now);
    } catch (error) { throw new InputError(error instanceof Error ? error.message : "Invalid reminder."); }
    if (!nextRunAt) throw new InputError("This reminder has no future occurrence. Choose a future date/time.");
    return { frequency, timeZone, channels, offsetMinutes: offsetMinutes as number | null,
      target: target as "START" | "DUE" | "END" | null, firstRunAt, nextRunAt, repeatUntil, rule: normalizedRule };
  });
  return {
    title: text(input.title, "Title", 200, true)!, notes: text(input.notes, "Notes", 10000),
    category: text(input.category, "Category", 100), location: text(input.location, "Location", 500), url,
    startsAt, endsAt, dueAt, allDay: boolean(input.allDay, "All day"), autoCompleteOnDue, reminders,
  };
}
