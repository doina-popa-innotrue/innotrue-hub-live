-- ============================================================================
-- Module Time-Gating: add available_from_date and unlock_after_days
-- ============================================================================
-- Two complementary strategies:
--   1. available_from_date  — absolute date: module unlocks on this date
--   2. unlock_after_days    — relative: module unlocks N days after enrollment
-- If both are set, the later date wins (i.e. the module is locked until BOTH
-- conditions are satisfied).
-- NULL means no time-gate for that dimension.
-- ============================================================================

-- Add columns to program_modules
ALTER TABLE public.program_modules
  ADD COLUMN IF NOT EXISTS available_from_date DATE,
  ADD COLUMN IF NOT EXISTS unlock_after_days INTEGER;

-- Add a CHECK to prevent negative values
ALTER TABLE public.program_modules
  ADD CONSTRAINT unlock_after_days_non_negative CHECK (unlock_after_days IS NULL OR unlock_after_days >= 0);

COMMENT ON COLUMN public.program_modules.available_from_date IS 'Absolute date when this module becomes available. NULL = no date restriction.';
COMMENT ON COLUMN public.program_modules.unlock_after_days IS 'Number of days after enrollment start when this module unlocks. NULL = no relative restriction.';
