-- =============================================================================
-- Idempotent restore of ALL cron jobs
-- =============================================================================
-- Run this after a PITR restore, project recreation, or any scenario where
-- cron jobs were lost but the underlying DB functions still exist.
--
-- Safe to run multiple times: unschedules each job first, then re-creates.
--
-- Prerequisites:
--   - pg_cron and pg_net extensions must be enabled
--   - All referenced DB functions must already exist (created by earlier migrations)
--   - For HTTP-based jobs, edge functions must be deployed separately
-- =============================================================================

-- Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── Helper: safely unschedule a job (no error if it doesn't exist) ──────────
DO $$
DECLARE
  job_names text[] := ARRAY[
    'monthly-credit-rollover',
    'cleanup-webhook-logs-daily',
    'cohort-session-reminders',
    'daily-credit-expiry',
    'daily-credit-expiry-notifications',
    'daily-notification-cleanup',
    'daily-analytics-cleanup',
    'daily-coach-access-log-cleanup',
    'daily-enforce-enrollment-deadlines'
  ];
  jn text;
BEGIN
  FOREACH jn IN ARRAY job_names LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = jn) THEN
      PERFORM cron.unschedule(jn);
    END IF;
  END LOOP;
END;
$$;

-- ── 1. Monthly credit rollover (1st of month, midnight UTC) ─────────────────
SELECT cron.schedule(
  'monthly-credit-rollover',
  '0 0 1 * *',
  $$SELECT public.process_monthly_credit_rollovers()$$
);

-- ── 2. Daily credit batch expiry (2 AM UTC) ─────────────────────────────────
SELECT cron.schedule(
  'daily-credit-expiry',
  '0 2 * * *',
  $$SELECT public.expire_credit_batches()$$
);

-- ── 3. Webhook log cleanup (3 AM UTC) ───────────────────────────────────────
SELECT cron.schedule(
  'cleanup-webhook-logs-daily',
  '0 3 * * *',
  $$SELECT public.cleanup_old_webhook_logs(30)$$
);

-- ── 4. Credit expiry notifications via edge function (3 AM UTC) ─────────────
SELECT cron.schedule(
  'daily-credit-expiry-notifications',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/credit-expiry-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  )$$
);

-- ── 5. Notification cleanup via edge function (4 AM UTC) ────────────────────
SELECT cron.schedule(
  'daily-notification-cleanup',
  '0 4 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  ) AS request_id;$$
);

-- ── 6. Coach access log cleanup (4:15 AM UTC) ──────────────────────────────
SELECT cron.schedule(
  'daily-coach-access-log-cleanup',
  '15 4 * * *',
  $$SELECT public.cleanup_old_coach_access_logs();$$
);

-- ── 7. Analytics events cleanup (4:30 AM UTC) ──────────────────────────────
SELECT cron.schedule(
  'daily-analytics-cleanup',
  '30 4 * * *',
  $$SELECT public.cleanup_old_analytics_events();$$
);

-- ── 8. Enrollment deadline enforcement via edge function (5 AM UTC) ─────────
SELECT cron.schedule(
  'daily-enforce-enrollment-deadlines',
  '0 5 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/enforce-enrollment-deadlines',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  )$$
);

-- ── 9. Cohort session reminders (every 15 minutes) ─────────────────────────
SELECT cron.schedule(
  'cohort-session-reminders',
  '*/15 * * * *',
  $$SELECT public.send_cohort_session_reminders()$$
);
