-- ============================================================================
-- Enrollment Source Tracking + Program-Level Capacity
-- ============================================================================
-- Part A: Track how enrollments originate (self, admin, code, waitlist, partner)
-- Part B: Add optional capacity limit to programs (parallel to cohort capacity)
-- ============================================================================

-- ──────────────────────────────────────────────
-- Part A: Enrollment Source Attribution
-- ──────────────────────────────────────────────

ALTER TABLE public.client_enrollments
  ADD COLUMN IF NOT EXISTS enrollment_source TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS referral_note TEXT;

COMMENT ON COLUMN public.client_enrollments.enrollment_source IS
  'How the enrollment was created: self, admin, enrollment_code, waitlist_promotion, partner_referral';
COMMENT ON COLUMN public.client_enrollments.referred_by IS
  'User ID of the coach/instructor/partner who referred or promoted this enrollment';
COMMENT ON COLUMN public.client_enrollments.referral_note IS
  'Free text context: partner name, promotion details, etc.';

-- Backfill existing enrollment-code enrollments
UPDATE public.client_enrollments
SET enrollment_source = 'enrollment_code'
WHERE enrollment_code_id IS NOT NULL AND enrollment_source IS NULL;

-- ──────────────────────────────────────────────
-- Part B: Program-Level Capacity
-- ──────────────────────────────────────────────

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS capacity INTEGER;

COMMENT ON COLUMN public.programs.capacity IS
  'Max active enrollments for this program. NULL = unlimited.';

-- Check program capacity (returns JSON with has_capacity, capacity, enrolled_count, available_spots)
CREATE OR REPLACE FUNCTION public.check_program_capacity(p_program_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_capacity integer;
  v_enrolled integer;
BEGIN
  SELECT capacity INTO v_capacity
  FROM programs WHERE id = p_program_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Program not found');
  END IF;

  SELECT count(*) INTO v_enrolled
  FROM client_enrollments
  WHERE program_id = p_program_id AND status = 'active';

  RETURN jsonb_build_object(
    'has_capacity', v_capacity IS NULL OR v_enrolled < v_capacity,
    'capacity', v_capacity,
    'enrolled_count', v_enrolled,
    'available_spots', CASE WHEN v_capacity IS NULL THEN NULL ELSE GREATEST(0, v_capacity - v_enrolled) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_program_capacity(uuid) TO authenticated;
