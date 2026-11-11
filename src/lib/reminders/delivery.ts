import nodemailer from "nodemailer";
import * as webpush from "web-push";

export function emailConfigured() { return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD); }
export function pushConfigured() { return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT); }

export async function sendEmail(to: string, title: string, message: string, deliveryId: string) {
  if (!emailConfigured()) throw new Error("Gmail SMTP is not configured.");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
    connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 8_000,
  });
  try {
    const result = await transport.sendMail({
      from: { name: "Verdant reminders", address: process.env.GMAIL_USER! }, to,
      subject: `Reminder: ${title.replace(/[\r\n]/g, " ")}`, text: message,
      messageId: `<${deliveryId}@verdant.reminders>`,
    });
    if (!result.accepted.length) throw new Error("Email was not accepted by SMTP.");
  } finally { transport.close(); }
}

export async function sendPush(subscription: { endpoint: string; p256dh: string; auth: string }, title: string, message: string, tag: string) {
  if (!pushConfigured()) throw new Error("Browser push is not configured.");
  await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    JSON.stringify({ title, body: message, url: "/events", tag }), {
      vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
      TTL: 3600, timeout: 10_000,
    });
}

export function isQuietHour(start: number | null | undefined, end: number | null | undefined, timeZone: string, now: Date) {
  if (start == null || end == null || start === end) return false;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function validPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && (!url.port || url.port === "443") &&
      (host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" || host.endsWith(".push.services.mozilla.com") ||
       host === "web.push.apple.com" || host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com"));
  } catch { return false; }
}
