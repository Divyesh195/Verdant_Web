1. Supabase Cron runs every minute: Cron -> Edge Function `reminder-cron` -> Vercel `GET /api/cron/reminders`.

2. The API sends due email/browser reminders, prepares the next occurrence, and automatically completes opted-in events at their deadline.

3. `EDGE_CRON_SECRET` authenticates Cron -> Edge. `CRON_SECRET` authenticates Edge -> Vercel and must match in both services.

4. Deploying the function does not start Cron. Run `supabase/schedules/reminder-cron.sql` after configuring Edge secrets and Vault.

5. See [setup and local testing](../docs/supabase-reminder-cron.md). Check Supabase Cron history, Edge logs and HTTP results for failures.
