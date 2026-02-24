-- Schedule credit expiry notification cron (daily at 3 AM UTC, after batch expiry at 2 AM)
-- Calls the credit-expiry-notifications edge function which:
--   - Finds batches expiring within 7 days (users) / 30 days (orgs)
--   - Sends create_notification('credits_expiring') to affected users/org admins
--   - Deduplicates: only one notification per user per day

SELECT cron.schedule(
  'daily-credit-expiry-notifications',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/credit-expiry-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  )$$
);
