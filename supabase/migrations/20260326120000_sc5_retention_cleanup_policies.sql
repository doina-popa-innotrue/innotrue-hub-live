-- =============================================================================
-- SC-5: Retention & Cleanup Policies
-- =============================================================================
-- Schedules automated cleanup for append-only tables that grow indefinitely.
-- admin_audit_logs intentionally NOT cleaned (compliance).
-- credit_consumption_log intentionally NOT cleaned (bounded by usage).
-- credit-maintenance already has daily-credit-expiry cron (verified).
-- =============================================================================

-- ── 1. Schedule notifications cleanup ───────────────────────────────────────
-- cleanup_old_notifications() function already exists (20260118 migration).
-- cleanup-notifications edge function already exists.
-- Only the cron trigger was missing.

SELECT cron.schedule(
  'daily-notification-cleanup',
  '0 4 * * *',  -- 4 AM UTC daily
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  ) AS request_id;$$
);

-- ── 2. analytics_events automated cleanup ───────────────────────────────────
-- Previously manual-only via DataCleanupManager. Now runs daily.

CREATE OR REPLACE FUNCTION public.cleanup_old_analytics_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_days integer;
  deleted_count integer;
BEGIN
  SELECT COALESCE(value::integer, 180) INTO retention_days
  FROM public.system_settings
  WHERE key = 'analytics_retention_days';

  IF retention_days IS NULL THEN
    retention_days := 180;
  END IF;

  DELETE FROM public.analytics_events
  WHERE created_at < NOW() - (retention_days || ' days')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_analytics_events() TO service_role;

SELECT cron.schedule(
  'daily-analytics-cleanup',
  '30 4 * * *',  -- 4:30 AM UTC daily
  $$SELECT public.cleanup_old_analytics_events();$$
);

-- ── 3. coach_access_logs automated cleanup ──────────────────────────────────
-- Every coach page view generates a row. 90-day retention is reasonable.

CREATE OR REPLACE FUNCTION public.cleanup_old_coach_access_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_days integer;
  deleted_count integer;
BEGIN
  SELECT COALESCE(value::integer, 90) INTO retention_days
  FROM public.system_settings
  WHERE key = 'coach_log_retention_days';

  IF retention_days IS NULL THEN
    retention_days := 90;
  END IF;

  DELETE FROM public.coach_access_logs
  WHERE accessed_at < NOW() - (retention_days || ' days')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_coach_access_logs() TO service_role;

SELECT cron.schedule(
  'daily-coach-access-log-cleanup',
  '15 4 * * *',  -- 4:15 AM UTC daily
  $$SELECT public.cleanup_old_coach_access_logs();$$
);

-- ── 4. Configurable retention settings ──────────────────────────────────────

INSERT INTO public.system_settings (key, value, description)
VALUES
  ('analytics_retention_days', '180', 'Days to retain analytics_events before automated cleanup'),
  ('coach_log_retention_days', '90', 'Days to retain coach_access_logs before automated cleanup')
ON CONFLICT (key) DO NOTHING;
