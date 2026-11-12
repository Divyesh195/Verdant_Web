# Supabase reminder cron setup

## 1. Configure secrets

Run twice to generate two different secrets:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

| Location | Name | Value |
| --- | --- | --- |
| Vercel environment | `CRON_SECRET` | First generated value |
| Supabase Edge secrets | `CRON_SECRET` | Same first value |
| Supabase Edge secrets | `EDGE_CRON_SECRET` | Second generated value |
| Supabase Edge secrets | `REMINDER_API_URL` | `https://YOUR-DOMAIN/api/cron/reminders` |

Deploy the website after changing its environment. Keep secrets private; enter values without quotes or `Bearer `. Gmail and push settings are in [the reminder guide](events-and-reminders.md).

## 2. Deploy the Edge Function

```sh
npx supabase login
npx supabase functions deploy reminder-cron --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with the reference from `https://YOUR_PROJECT_REF.supabase.co`. The function uses custom bearer authentication configured in `supabase/config.toml`.

## 3. Enable Cron

Create these Supabase Vault secrets:

- `reminder_edge_url`: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/reminder-cron`
- `reminder_edge_token`: the same value as `EDGE_CRON_SECRET`

Run [reminder-cron.sql](../supabase/schedules/reminder-cron.sql) in Supabase's SQL editor. It schedules `verdant-reminder-cron` every minute. Deployment alone does not enable Cron. The deployed relay cannot reach your computer's localhost; use the production website URL.

## Local API test

Set `CRON_SECRET` in `.env.local`, start `npm run dev`, then run in PowerShell:

```powershell
$headers = @{ Authorization = 'Bearer YOUR_CRON_SECRET' }
Invoke-RestMethod -Uri 'http://localhost:3000/api/cron/reminders' -Headers $headers -Method Get
```

This processes real due reminders/completions in the configured database. It does not require deploying the Edge Function.

## Monitor or stop

Check Cron history and Edge Function logs. Cron success only means the HTTP request was queued; check HTTP results too:

```sql
select id, status_code, timed_out, error_msg
from net._http_response order by created desc limit 20;
```

`401`: Edge token mismatch. `503`: missing/invalid Edge settings. `502` with upstream `401`: Vercel secret mismatch. Other `502`: check website reachability and worker logs. A `200` with zero counters means no work was found.

Stop the schedule:

```sql
select cron.unschedule('verdant-reminder-cron');
```

Keep one scheduler enabled. See [Supabase scheduling documentation](https://supabase.com/docs/guides/functions/schedule-functions) for platform details.
