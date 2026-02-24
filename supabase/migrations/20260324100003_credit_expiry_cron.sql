-- Add daily cron job for proactive credit batch expiration.
-- expire_credit_batches() already exists (created in 20260117 migration)
-- and is called lazily by get_user_credit_summary_v2/get_org_credit_summary_v2,
-- but batches for inactive users can stay "active" past their expiry date
-- until someone checks their credits. This cron ensures all expired batches
-- are marked promptly.

SELECT cron.schedule(
  'daily-credit-expiry',
  '0 2 * * *',  -- Run at 2 AM UTC daily
  $$SELECT public.expire_credit_batches()$$
);
