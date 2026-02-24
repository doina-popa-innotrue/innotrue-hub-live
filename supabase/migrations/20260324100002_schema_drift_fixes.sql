-- Schema Drift Fix Sprint 2: Miscellaneous schema corrections

-- 2E: Make payment_schedules.enrollment_id nullable
-- Installment checkout creates payment_schedules BEFORE enrollment completes,
-- so enrollment_id must be nullable. The enrollment_id is linked later.
ALTER TABLE public.payment_schedules ALTER COLUMN enrollment_id DROP NOT NULL;

-- 2F: organizations.platform_tier_id doesn't exist — no migration needed,
-- the code fix removes it from the SELECT query.
