# Events and reminders

The implementation lives at `/events`. PostgreSQL is the source of truth; recipients are resolved through `Reminder -> Event -> User`, with no direct User/Reminder relation.

## Events you can create

Categories are free text. The form suggests personal, meeting, appointment, deadline, shopping, movie, birthday, anniversary, bill, travel and habit. Categories do not change scheduling behavior.

- Dated events with a start, optional end and/or deadline.
- All-day events with explicitly selected reminder times.
- Dateless tasks with independently dated reminders.
- Events without any reminders.
- Manual completion, cancellation, or opt-in automatic completion at a deadline.
- Completed events with an optional linked successor and a new deadline. The original remains in history. No successor is created without a user action.

Each event supports notes, location and an optional HTTP/HTTPS link. The list shows the most recent 500 events, with active/completed/cancelled filters.

## Reminders you can set

Up to 10 reminder schedules per event, each with email, browser push or both:

| Schedule | Example |
| --- | --- |
| One-time chosen date/time | Shopping tomorrow at 6 PM |
| At the start/deadline/end | Meeting starts now |
| Before a target | One day and 30 minutes before a meeting, as two reminders |
| After a target | Follow up two hours after the end |
| Daily | Read at 8 PM |
| Every N days | Water plants every three days |
| Weekly | Shopping every Saturday |
| Selected weekdays | Exercise Monday, Wednesday and Friday |
| Every N weeks | Every other week on Monday and Wednesday |
| Monthly / every N months | Bill on the 5th; quarterly review every three months |
| Yearly / every N years | Birthday or anniversary reminder |
| Optional repeat end | Repeat until a selected date/time |

N ranges from 1 to 100. Weekly intervals start on Monday. Local clock times follow the selected IANA timezone. Monthly dates that do not exist and February 29 in non-leap years are skipped. Missing DST times are skipped; repeated local times use the first occurrence. The date/time inputs use the browser timezone; recurrence uses the reminder timezone. Changing a target date recalculates its offset reminders.

Reminders repeat for the same active event until their repeat end, completion or cancellation. Creating another event after completion is a separate, optional action. Completion suppresses all remaining reminders, including positive-offset reminders. Automatically completed events suppress reminders at the exact deadline.

No hourly/cron/RRULE schedules, last-weekday rules, snooze, daily digests, SMS, WhatsApp, automatic successor creation, or automatic birthday-date inference are included. A birthday category still needs a chosen date and yearly reminder.

## Gmail setup

Set these in `.env.local` for development and in the Vercel project's environment variables for deployment:

```text
GMAIL_USER=your-sending-address@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
CRON_SECRET=a-long-random-secret
```

Use Google's [app-password setup](https://support.google.com/accounts/answer/185833), normally with 2-Step Verification enabled. The implementation uses `smtp.gmail.com:465` with TLS. Some managed Google accounts do not allow app passwords; those require an OAuth-based configuration instead. Do not use your normal account password.

Email is sent to the signed-in event owner's address, from `GMAIL_USER`. Email preferences can disable email or defer it during quiet hours (in the individual reminder's timezone). Equal start/end hours mean no quiet period. Browser push is independent of email quiet hours.

## Browser push setup

Generate VAPID keys on a trusted local machine:

```sh
npx web-push generate-vapid-keys
```

Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (for example `mailto:you@example.com`) in the environment, then rebuild. Keep the private key stable between deployments; replacing it requires browser resubscription.

Open `/events` and choose **Enable notifications on this browser**. This requires HTTPS (or localhost) and browser permission. Subscribe each device separately. Supported push-service endpoints include Google, Mozilla, Apple and Windows. The form records per-reminder channel choices; subscription ownership is checked on each delivery. Expired subscriptions are deactivated. Up to 10 active browser subscriptions per user are supported.

## Scheduling on Vercel Hobby

Vercel Hobby's built-in cron is limited to once per day, so it is intentionally not configured for these time-sensitive reminders. See [Vercel's cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Configure an external HTTPS scheduler with:

```text
Method: GET
URL: https://YOUR-PRODUCTION-DOMAIN/api/cron/reminders
Frequency: every minute
Header: Authorization: Bearer YOUR_CRON_SECRET
Timeout: at least 60 seconds
```

Store the token as a scheduler secret. Never put it in the URL. If Vercel deployment protection applies, configure the scheduler's supported protection bypass separately. The endpoint rejects requests without the correct secret, including when the server secret is unset. A failed worker returns HTTP 500; delivery-level errors are recorded separately.

The worker sends due reminders and automatically completes opted-in events when invoked. Timing is approximate: the next scheduler run, runtime limits, provider/network delay and quiet hours affect delivery. It does not promise exact-second notifications. Without the external trigger, neither reminders nor background automatic completion run.

On a later move to a Vercel plan supporting per-minute cron, add a `crons` entry for `/api/cron/reminders` with schedule `* * * * *`, retaining `CRON_SECRET`.

## Reliability and limits

- Short database transactions and expiring per-reminder leases avoid normal overlapping sends. Event changes temporarily return a retry message while a reminder is being processed.
- Delivery records are unique per reminder occurrence, channel and device. Successful channels are not resent when another channel fails.
- Transient failures retry with backoff, up to five attempts. Exhausted deliveries are cancelled with an explanation shown on the event; later recurring occurrences can still run.
- Gmail SMTP has no provider idempotency key. A crash after SMTP accepts the email but before the database records success can cause a duplicate on retry. A stable Message-ID helps tracing but does not guarantee deduplication. Browser push also cannot guarantee exactly-once delivery.
- An overdue stored occurrence is sent once, then other missed occurrences are skipped. The next time is calculated from the original calendar anchor, so late delivery does not shift future times.
- Browser notifications with no subscribed device are skipped explicitly. Enabling push later affects future occurrences, not previously skipped ones.
- Editing retires old reminders and cancels their pending deliveries, retaining history. Use future times when editing one-time reminders.
- Following up copies details and current reminder settings, shifting independent reminder dates by the deadline change. If the old event has no deadline/start, independent reminders anchor to the new deadline. Adjust the resulting event if a copied reminder would already be past.
- Automatic completion is marked separately from manual completion; passing a movie deadline is not proof it was watched.

## Database and verification

The additive migration is `prisma/migrations/20261111000000_events_and_reminders/migration.sql`. Existing user UUIDs and fields are preserved. `Event_DB_Schema.prisma` mirrors the application schema; edit `prisma/schema.prisma` as the source of truth.

For other environments, run `npx prisma migrate deploy` with that environment's database configuration, then `npx prisma generate`. `vercel.json` generates the client during builds. Migrations are intentionally separate from builds.

```sh
node --test --test-isolation=none scripts/reminder-schedule.test.mjs scripts/events.test.mjs
npx prisma validate
npm run build
```

Optional database smoke check (uses temporary records in one rolled-back transaction; does not send notifications):

```sh
node scripts/events-db-smoke.mjs
```

The automated tests use mocked transports. A real Gmail/browser delivery check requires configured sender credentials, browser permission and a deployed scheduler; no email is sent merely by running tests or building the project.
