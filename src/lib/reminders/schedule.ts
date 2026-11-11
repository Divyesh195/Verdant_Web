export type Frequency = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type ReminderSchedule = {
  firstRunAt: Date;
  frequency: Frequency;
  timeZone: string;
  rule?: { interval?: number; weekdays?: number[] } | null;
  repeatUntil?: Date | null;
  lastScheduledFor?: Date | null;
  enabled: boolean;
};

const DAY = 86_400_000;

function timestamp(date: Date): number {
  const value = date.getTime();
  if (!Number.isFinite(value)) throw new Error("Invalid schedule date.");
  return value;
}

/** Explicit target: START, DUE or END is selected by the caller. */
export function getFirstRunAt(targetAt: Date | null, offsetMinutes: number | null, explicitAt?: Date): Date {
  if (offsetMinutes !== null) {
    if (!targetAt || !Number.isSafeInteger(offsetMinutes)) {
      throw new Error("An offset requires a target date and whole minutes.");
    }
    const result = new Date(timestamp(targetAt) + offsetMinutes * 60_000);
    timestamp(result);
    return result;
  }
  if (!explicitAt) throw new Error("Choose a reminder date/time.");
  return new Date(timestamp(explicitAt));
}

/** Calendar recurrence in an IANA zone; skip invalid dates and DST gaps.
 * Repeated local times use the earliest matching instant.
 * Call only to initialize/recalculate, or AFTER successfully processing an occurrence.
 * A stored overdue nextRunAt must be delivered before advancing it.
 */
export function getNextRunAt(
  schedule: ReminderSchedule,
  eventStatus: "ACTIVE" | "COMPLETED" | "CANCELLED",
  now = new Date(),
): Date | null {
  if (!schedule.enabled || eventStatus !== "ACTIVE") return null;
  const anchor = timestamp(schedule.firstRunAt);
  const lowerBound = Math.max(timestamp(now), schedule.lastScheduledFor
    ? timestamp(schedule.lastScheduledFor) + 1 : -Infinity);
  const until = schedule.repeatUntil ? timestamp(schedule.repeatUntil) : Infinity;
  if (schedule.frequency === "ONCE") {
    return anchor >= lowerBound && anchor <= until ? new Date(anchor) : null;
  }
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(schedule.frequency)) {
    throw new Error("Unsupported reminder frequency.");
  }
  const interval = schedule.rule?.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 100) {
    throw new Error("Repeat interval must be between 1 and 100.");
  }
  const weekdays = schedule.rule?.weekdays;
  if (weekdays && (schedule.frequency !== "WEEKLY" || !weekdays.length ||
      weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6))) {
    throw new Error("Weekdays must be 0..6 and are only valid for weekly reminders.");
  }
  if (lowerBound > until) return null;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: schedule.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  // Represent local calendar components as a UTC number for calendar arithmetic.
  const localNumber = (instant: number): number => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant))
      .map(part => [part.type, part.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day,
      +parts.hour, +parts.minute, +parts.second);
  };
  const anchorLocal = new Date(localNumber(anchor));
  const anchorDay = Date.UTC(anchorLocal.getUTCFullYear(), anchorLocal.getUTCMonth(), anchorLocal.getUTCDate());
  const startLocal = new Date(localNumber(Math.max(anchor, lowerBound)));
  let day = Date.UTC(startLocal.getUTCFullYear(), startLocal.getUTCMonth(), startLocal.getUTCDate());
  // Start one local day earlier to include offset transitions around the boundary.
  day = Math.max(anchorDay, day - DAY);
  const anchorWeekday = anchorLocal.getUTCDay();
  const weekStart = anchorDay - ((anchorWeekday + 6) % 7) * DAY;
  const clock = anchorLocal.getUTCHours() * 3_600_000 +
    anchorLocal.getUTCMinutes() * 60_000 + anchorLocal.getUTCSeconds() * 1000;

  for (let scanned = 0; scanned <= 8 * 366 * interval; scanned++, day += DAY) {
    const candidate = new Date(day);
    const months = (candidate.getUTCFullYear() - anchorLocal.getUTCFullYear()) * 12 +
      candidate.getUTCMonth() - anchorLocal.getUTCMonth();
    let matches = false;
    switch (schedule.frequency) {
      case "DAILY": matches = ((day - anchorDay) / DAY) % interval === 0; break;
      case "WEEKLY":
        matches = Math.floor((day - weekStart) / (7 * DAY)) % interval === 0 &&
          (weekdays ?? [anchorWeekday]).includes(candidate.getUTCDay());
        break;
      case "MONTHLY":
        matches = months % interval === 0 && candidate.getUTCDate() === anchorLocal.getUTCDate();
        break;
      case "YEARLY":
        matches = (candidate.getUTCFullYear() - anchorLocal.getUTCFullYear()) % interval === 0 &&
          candidate.getUTCMonth() === anchorLocal.getUTCMonth() &&
          candidate.getUTCDate() === anchorLocal.getUTCDate();
        break;
    }
    if (!matches) continue;
    const wallTime = day + clock;
    // Try offsets on both sides of a transition, then verify the local clock.
    const instants = [-DAY, 0, DAY].map(delta => {
      const sample = wallTime + delta;
      return wallTime - (localNumber(sample) - sample);
    }).filter(instant => localNumber(instant) === wallTime).sort((a, b) => a - b);
    if (!instants.length) continue;
    const instant = instants[0] + schedule.firstRunAt.getUTCMilliseconds();
    if (instant > until) return null;
    if (instant >= anchor && instant >= lowerBound) return new Date(instant);
  }
  throw new Error("No next occurrence found within the supported calendar search range.");
}

export function shouldAutoComplete(event: {
  status: string; autoCompleteOnDue: boolean; dueAt: Date | null;
}, now = new Date()): boolean {
  return event.status === "ACTIVE" && event.autoCompleteOnDue && event.dueAt !== null &&
    timestamp(event.dueAt) <= timestamp(now);
}

/** Look up the event owner, never a recipient ID supplied by the browser. */
export async function resolveReminderRecipient<T extends { id: string; email: string; isActive: boolean }>(
  eventUserId: string,
  findUser: (id: string) => Promise<T | null>,
): Promise<T | null> {
  const user = await findUser(eventUserId);
  return user?.id === eventUserId && user.isActive ? user : null;
}
