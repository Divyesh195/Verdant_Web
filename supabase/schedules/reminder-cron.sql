-- Run manually in the Supabase SQL editor after deploying the Edge Function
-- and creating reminder_edge_url and reminder_edge_token in Supabase Vault.
-- This starts live background processing; do not run against a preview deployment.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'reminder_edge_url' and decrypted_secret <> '')
     or not exists (select 1 from vault.decrypted_secrets where name = 'reminder_edge_token' and decrypted_secret <> '') then
    raise exception 'Create reminder_edge_url and reminder_edge_token in Vault before scheduling.';
  end if;
end;
$$;

-- Re-running replaces the schedule for this named job.
select cron.schedule(
  'verdant-reminder-cron',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_edge_url' limit 1),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_edge_token' limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 65000
    );
  $job$
);

-- Stop: select cron.unschedule('verdant-reminder-cron');
-- Inspect cron runs: select * from cron.job_run_details order by start_time desc limit 20;
-- Inspect HTTP outcomes: select id, status_code, timed_out, error_msg from net._http_response order by created desc limit 20;
-- Cron success means the HTTP request was queued. Check HTTP status and Edge logs as well.
