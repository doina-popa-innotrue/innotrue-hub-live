-- ============================================================================
-- Cohort Waitlist: table, RLS, functions
-- ============================================================================
-- Allows clients to join a waitlist when a cohort is at capacity.
-- Admins can promote users from the waitlist into the cohort.
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. Create cohort_waitlist table
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cohort_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.program_cohorts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, cohort_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_waitlist_cohort_id ON public.cohort_waitlist(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_waitlist_position ON public.cohort_waitlist(cohort_id, position);

-- ──────────────────────────────────────────────
-- 2. RLS Policies
-- ──────────────────────────────────────────────

ALTER TABLE public.cohort_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own waitlist entries"
  ON public.cohort_waitlist FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own waitlist entries"
  ON public.cohort_waitlist FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own waitlist entries"
  ON public.cohort_waitlist FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all waitlist entries"
  ON public.cohort_waitlist FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ──────────────────────────────────────────────
-- 3. check_cohort_capacity function
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_cohort_capacity(p_cohort_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_capacity integer;
  v_enrolled integer;
  v_waitlist integer;
BEGIN
  SELECT capacity INTO v_capacity
  FROM program_cohorts WHERE id = p_cohort_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Cohort not found');
  END IF;

  SELECT count(*) INTO v_enrolled
  FROM client_enrollments
  WHERE cohort_id = p_cohort_id AND status = 'active';

  SELECT count(*) INTO v_waitlist
  FROM cohort_waitlist WHERE cohort_id = p_cohort_id;

  RETURN jsonb_build_object(
    'has_capacity', v_capacity IS NULL OR v_enrolled < v_capacity,
    'capacity', v_capacity,
    'enrolled_count', v_enrolled,
    'waitlist_count', v_waitlist,
    'available_spots', CASE WHEN v_capacity IS NULL THEN NULL ELSE GREATEST(0, v_capacity - v_enrolled) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_cohort_capacity(uuid) TO authenticated;

-- ──────────────────────────────────────────────
-- 4. join_cohort_waitlist function
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.join_cohort_waitlist(p_cohort_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_next_position integer;
  v_capacity_check jsonb;
BEGIN
  -- Check if already enrolled
  IF EXISTS (
    SELECT 1 FROM client_enrollments
    WHERE client_user_id = v_user_id AND cohort_id = p_cohort_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already enrolled in this cohort');
  END IF;

  -- Check capacity — only allow waitlist when cohort is full
  v_capacity_check := check_cohort_capacity(p_cohort_id);
  IF (v_capacity_check->>'has_capacity')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cohort has available spots — enroll directly');
  END IF;

  -- Get next position
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position
  FROM cohort_waitlist WHERE cohort_id = p_cohort_id;

  -- Insert (UNIQUE constraint prevents duplicates)
  INSERT INTO cohort_waitlist (user_id, cohort_id, position)
  VALUES (v_user_id, p_cohort_id, v_next_position);

  RETURN jsonb_build_object('success', true, 'position', v_next_position);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'Already on the waitlist');
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_cohort_waitlist(uuid) TO authenticated;
