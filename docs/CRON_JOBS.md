# Cron Jobs — Monitoring, Management & Recovery

> Last updated: 2026-02-28

## Overview

InnoTrue Hub uses **9 scheduled cron jobs** running inside Supabase PostgreSQL via the `pg_cron` extension. These handle credit lifecycle, cleanup, notifications, session reminders, and enrollment enforcement.

**Two execution patterns:**
- **Direct SQL** (6 jobs): `cron.schedule` calls a PostgreSQL function directly
- **Edge function via HTTP** (3 jobs): `cron.schedule` calls `net.http_post` to invoke a Supabase edge function

## Daily Execution Timeline (UTC)

| Time (UTC) | Job Name | Type | What It Does |
|------------|----------|------|--------------|
| `*/15 * * * *` | `cohort-session-reminders` | Direct SQL | Send 24h + 1h reminders for cohort sessions |
| `0 0 1 * *` | `monthly-credit-rollover` | Direct SQL | Process monthly credit batch rollovers |
| `0 2 * * *` | `daily-credit-expiry` | Direct SQL | Mark expired credit batches as expired |
| `0 3 * * *` | `cleanup-webhook-logs-daily` | Direct SQL | Delete webhook logs older than 30 days |
| `0 3 * * *` | `daily-credit-expiry-notifications` | HTTP → Edge Fn | Notify users/orgs of expiring credits |
| `0 4 * * *` | `daily-notification-cleanup` | HTTP → Edge Fn | Delete old notifications past retention |
| `15 4 * * *` | `daily-coach-access-log-cleanup` | Direct SQL | Delete coach access logs past retention |
| `30 4 * * *` | `daily-analytics-cleanup` | Direct SQL | Delete analytics events past retention |
| `0 5 * * *` | `daily-enforce-enrollment-deadlines` | HTTP → Edge Fn | Warn/auto-complete expiring enrollments |

## Monitoring

### Via Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard** > **Database** > **Extensions** and verify `pg_cron` and `pg_net` are enabled
2. Query the `cron.job` table to see all registered jobs:

```sql
SELECT jobid, jobname, schedule, command, active
FROM cron.job
ORDER BY jobname;
```

3. Query execution history (last 24 hours):

```sql
SELECT j.jobname, d.status, d.start_time, d.end_time,
       d.end_time - d.start_time AS duration,
       d.return_message
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE d.start_time > NOW() - INTERVAL '24 hours'
ORDER BY d.start_time DESC;
```

4. Check for recent failures:

```sql
SELECT j.jobname, d.status, d.start_time, d.return_message
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE d.status = 'failed'
  AND d.start_time > NOW() - INTERVAL '7 days'
ORDER BY d.start_time DESC;
```

### Quick Health Check

Run this to verify all 9 jobs are registered and active:

```sql
SELECT jobname, schedule, active,
  (SELECT MAX(start_time) FROM cron.job_run_details WHERE jobid = j.jobid) AS last_run,
  (SELECT status FROM cron.job_run_details WHERE jobid = j.jobid ORDER BY start_time DESC LIMIT 1) AS last_status
FROM cron.job j
ORDER BY jobname;
```

Expected output: 9 rows, all with `active = true`.

### Cleanup of Run History

`pg_cron` keeps run history in `cron.job_run_details` indefinitely. To prevent table bloat:

```sql
-- Delete run history older than 30 days (safe to run periodically)
DELETE FROM cron.job_run_details
WHERE end_time < NOW() - INTERVAL '30 days';
```

## Job Details

### 1. `cohort-session-reminders`

| | |
|---|---|
| **Schedule** | Every 15 minutes (`*/15 * * * *`) |
| **Type** | Direct SQL |
| **Function** | `public.send_cohort_session_reminders()` |
| **Migration** | `20260219300000_g6_session_reminders.sql` |
| **Purpose** | Sends in-app notifications to cohort members 24 hours and 1 hour before scheduled sessions |
| **Dedup** | Uses `cohort_session_reminder_log` table to prevent duplicate sends |

### 2. `monthly-credit-rollover`

| | |
|---|---|
| **Schedule** | Midnight UTC, 1st of each month (`0 0 1 * *`) |
| **Type** | Direct SQL |
| **Function** | `public.process_monthly_credit_rollovers()` |
| **Migration** | `20260111002858_38e2a994-4efe-4a42-ba23-f9db8b6c4dc6.sql` |
| **Purpose** | Processes monthly credit rollover logic for user and org credit batches |

### 3. `daily-credit-expiry`

| | |
|---|---|
| **Schedule** | 2:00 AM UTC daily (`0 2 * * *`) |
| **Type** | Direct SQL |
| **Function** | `public.expire_credit_batches()` |
| **Migration** | `20260324100003_credit_expiry_cron.sql` |
| **Purpose** | Marks all expired credit batches. Without this, batches for inactive users stay "active" until they log in. |
| **Note** | Runs BEFORE credit expiry notifications (3 AM) so notifications reflect accurate state |

### 4. `cleanup-webhook-logs-daily`

| | |
|---|---|
| **Schedule** | 3:00 AM UTC daily (`0 3 * * *`) |
| **Type** | Direct SQL |
| **Function** | `public.cleanup_old_webhook_logs(30)` |
| **Migration** | `20260201081744_c161805b-9179-4a08-8fac-c48afc98a912.sql` |
| **Purpose** | Deletes `calcom_webhook_logs` entries older than 30 days |

### 5. `daily-credit-expiry-notifications`

| | |
|---|---|
| **Schedule** | 3:00 AM UTC daily (`0 3 * * *`) |
| **Type** | HTTP → Edge Function |
| **Edge Function** | `credit-expiry-notifications` |
| **Migration** | `20260324110001_credit_expiry_notification_cron.sql` |
| **Purpose** | Notifies users (7-day window) and org admins (30-day window) of expiring credit batches |
| **Dedup** | Checks `notification.metadata.batch_ids` to avoid repeat alerts |

### 6. `daily-notification-cleanup`

| | |
|---|---|
| **Schedule** | 4:00 AM UTC daily (`0 4 * * *`) |
| **Type** | HTTP → Edge Function |
| **Edge Function** | `cleanup-notifications` |
| **Migration** | `20260326120000_sc5_retention_cleanup_policies.sql` |
| **Purpose** | Deletes old notifications past the configurable retention period |

### 7. `daily-coach-access-log-cleanup`

| | |
|---|---|
| **Schedule** | 4:15 AM UTC daily (`15 4 * * *`) |
| **Type** | Direct SQL |
| **Function** | `public.cleanup_old_coach_access_logs()` |
| **Migration** | `20260326120000_sc5_retention_cleanup_policies.sql` |
| **Purpose** | Deletes `coach_access_logs` past retention period |
| **Retention** | Default 90 days (configurable via `system_settings` key `coach_log_retention_days`) |

### 8. `daily-analytics-cleanup`

| | |
|---|---|
| **Schedule** | 4:30 AM UTC daily (`30 4 * * *`) |
| **Type** | Direct SQL |
| **Function** | `public.cleanup_old_analytics_events()` |
| **Migration** | `20260326120000_sc5_retention_cleanup_policies.sql` |
| **Purpose** | Deletes `analytics_events` past retention period |
| **Retention** | Default 180 days (configurable via `system_settings` key `analytics_retention_days`) |

### 9. `daily-enforce-enrollment-deadlines`

| | |
|---|---|
| **Schedule** | 5:00 AM UTC daily (`0 5 * * *`) |
| **Type** | HTTP → Edge Function |
| **Edge Function** | `enforce-enrollment-deadlines` |
| **Migration** | `20260325200000_enrollment_duration.sql` |
| **Purpose** | Three phases: 30-day warning, 7-day warning, auto-complete expired enrollments |
| **Dedup** | Uses `enrollment_deadline_touchpoints` table with types: `deadline_warning_30d`, `deadline_warning_7d`, `deadline_expired` |

## Configurable Retention Periods

Cleanup jobs use `system_settings` for configurable retention. Change them via the Supabase SQL editor or admin UI:

```sql
-- View current settings
SELECT key, value, description FROM system_settings
WHERE key IN ('analytics_retention_days', 'coach_log_retention_days');

-- Update retention period
UPDATE system_settings SET value = '365' WHERE key = 'analytics_retention_days';
UPDATE system_settings SET value = '180' WHERE key = 'coach_log_retention_days';
```

## Management

### Pause a Job

```sql
-- Deactivate a specific job (stops it from running, keeps the definition)
UPDATE cron.job SET active = false WHERE jobname = 'daily-analytics-cleanup';
```

### Resume a Job

```sql
UPDATE cron.job SET active = true WHERE jobname = 'daily-analytics-cleanup';
```

### Change a Schedule

```sql
-- Example: move analytics cleanup to 6 AM instead of 4:30 AM
SELECT cron.schedule('daily-analytics-cleanup', '0 6 * * *',
  $$SELECT public.cleanup_old_analytics_events();$$);
```

Note: `cron.schedule` with an existing job name replaces the existing schedule.

### Remove a Job

```sql
SELECT cron.unschedule('job-name-here');
```

### Run a Job Manually (on demand)

For direct SQL jobs, just call the function:

```sql
-- Test credit expiry
SELECT public.expire_credit_batches();

-- Test analytics cleanup
SELECT public.cleanup_old_analytics_events();

-- Test webhook log cleanup
SELECT public.cleanup_old_webhook_logs(30);

-- Test session reminders
SELECT public.send_cohort_session_reminders();

-- Test credit rollover
SELECT public.process_monthly_credit_rollovers();

-- Test coach access log cleanup
SELECT public.cleanup_old_coach_access_logs();
```

For HTTP-based jobs, invoke the edge function directly:

```bash
# Credit expiry notifications
supabase functions invoke credit-expiry-notifications --project-ref <ref>

# Notification cleanup
supabase functions invoke cleanup-notifications --project-ref <ref>

# Enrollment deadline enforcement
supabase functions invoke enforce-enrollment-deadlines --project-ref <ref>
```

## Recovery — Restoring Cron Jobs from Scratch

Cron jobs are created by their respective migrations. When you push migrations to a new Supabase project (`supabase db push`), the cron jobs are automatically re-created.

**However**, if migrations have already been applied but cron jobs are missing (e.g., after a PITR restore that didn't include the `cron` schema, or manual deletion), use the dedicated restore script:

```bash
# Apply the cron restore migration to production
npm run push:migrations

# Or to a specific environment
npm run push:migrations -- preprod
```

The restore migration file is: `supabase/migrations/20260228120000_restore_all_cron_jobs.sql`

This migration is **idempotent** — it unschedules existing jobs (if any) before re-creating them, so it's safe to run multiple times.

### Manual Restore (SQL)

If you need to restore cron jobs without running migrations, execute the SQL from `supabase/migrations/20260228120000_restore_all_cron_jobs.sql` directly in the Supabase SQL editor.

### Verifying After Restore

After restoring, run the health check query:

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

Expected: 9 jobs, all active.

## Architecture Notes

- **Why `net.http_post` for some jobs?** Jobs that need external API calls (Resend email, complex business logic) use edge functions. Pure DB operations use direct SQL for lower latency.
- **Auth for HTTP jobs:** All use `current_setting('app.settings.service_role_key')` which Supabase auto-populates. No manual secret management needed for cron → edge function calls.
- **Deduplication:** Session reminders and enrollment deadlines use dedicated log tables to prevent duplicate sends even if the cron fires multiple times.
- **Ordering matters:** Credit expiry (2 AM) runs before credit notifications (3 AM) so users are notified about already-expired batches, not soon-to-expire ones.
