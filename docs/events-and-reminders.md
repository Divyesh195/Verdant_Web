# Events and reminders

At `/events`, create dated, all-day or dateless events with any category. Completion is manual or automatic at a deadline. An optional next deadline creates a new event while preserving the completed one.

## Reminder options

- Up to 10 schedules per event; email, browser push, or both.
- One-time date/time or before/at/after the start, deadline or end.
- Daily, weekly/selected weekdays, monthly or yearly; intervals 1–100 and optional repeat end.
- Reminders stop on completion/cancellation. Missing calendar dates are skipped.
- Date inputs use the browser timezone; recurrence uses the reminder timezone.

## Email setup

Set in `.env.local` and Vercel environment variables:

```env
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
```

Use a [Google app password](https://support.google.com/accounts/answer/185833), not your account password. Email goes to the event owner. Quiet hours defer email in each reminder's timezone; leave both hours blank to disable.

## Browser setup

Generate keys:

```sh
npx web-push generate-vapid-keys
```

Set these in `.env.local` and Vercel:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:your-address@gmail.com
```

Restart locally or redeploy. Keep keys stable and the private key server-only. In Notification settings, enable notifications on each browser, grant permission and select Browser push on the reminder. Requires HTTPS or localhost.

## Scheduler and checks

Follow [Supabase cron setup](supabase-reminder-cron.md). Without a trigger, background reminders and automatic completion do not run. Failed deliveries retry up to five times; SMTP duplicates remain possible after crashes.

```sh
npm run test:events
npm run test:reminder-relay
npm run build
```

Schema: `prisma/schema.prisma`. For another database, apply migrations using `npx prisma migrate deploy`, then run `npx prisma generate`.
