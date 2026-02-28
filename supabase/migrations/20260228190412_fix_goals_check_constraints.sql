-- Fix goals CHECK constraints: the constraints added in migration 20251129231512
-- use values ('active','on_hold','retired','completed' / 'short_term','medium_term','long_term')
-- that don't match the actual PostgreSQL enum values used by the app
-- ('not_started','in_progress','completed','paused' / 'short','medium','long').
-- This causes "Failed to create goal" on every insert.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Migrate any existing rows that used the old constraint values
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.goals SET status = 'in_progress' WHERE status = 'active';
UPDATE public.goals SET status = 'paused'      WHERE status = 'on_hold';
UPDATE public.goals SET status = 'paused'      WHERE status = 'retired';

UPDATE public.goals SET timeframe_type = 'short'  WHERE timeframe_type = 'short_term';
UPDATE public.goals SET timeframe_type = 'medium' WHERE timeframe_type = 'medium_term';
UPDATE public.goals SET timeframe_type = 'long'   WHERE timeframe_type = 'long_term';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Drop the incorrect CHECK constraints
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_status_check;
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_timeframe_type_check;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Add correct CHECK constraints matching the enum definitions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.goals
  ADD CONSTRAINT goals_status_check
  CHECK (status IN ('not_started', 'in_progress', 'completed', 'paused'));

ALTER TABLE public.goals
  ADD CONSTRAINT goals_timeframe_type_check
  CHECK (timeframe_type IN ('short', 'medium', 'long'));

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Fix the column default (was 'active', should be 'not_started')
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.goals ALTER COLUMN status SET DEFAULT 'not_started';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Fix the update_goal_progress() trigger function which referenced
-- the old 'active' status value
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_goal_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_milestones INTEGER;
  completed_milestones INTEGER;
  new_progress INTEGER;
  new_status TEXT;
  current_goal_status TEXT;
BEGIN
  -- Get current goal status
  SELECT status INTO current_goal_status
  FROM public.goals
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);

  -- Count total and completed milestones for the goal
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
  INTO total_milestones, completed_milestones
  FROM public.goal_milestones
  WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id);

  -- Calculate progress
  IF total_milestones > 0 THEN
    new_progress := (completed_milestones * 100 / total_milestones);
  ELSE
    new_progress := 0;
  END IF;

  -- Determine new status (only auto-update if goal is in_progress or not_started)
  IF current_goal_status IN ('not_started', 'in_progress') THEN
    IF completed_milestones = total_milestones AND total_milestones > 0 THEN
      new_status := 'completed';
    ELSIF completed_milestones > 0 THEN
      new_status := 'in_progress';
    ELSE
      new_status := current_goal_status;
    END IF;
  ELSE
    new_status := current_goal_status;
  END IF;

  -- Update the goal
  UPDATE public.goals
  SET
    progress_percentage = new_progress,
    status = new_status,
    updated_at = now()
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;
