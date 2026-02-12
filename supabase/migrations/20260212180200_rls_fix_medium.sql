-- =============================================================================
-- Migration: RLS Fix — MEDIUM Priority
-- =============================================================================
-- Fixes functional gaps from RLS audit (2026-02-12)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3.1  notification_preferences — Admin can't manage for other users
--      Only user-scoped SELECT/UPDATE/INSERT exist. Admin needs visibility
--      for user preference management pages.
-- ---------------------------------------------------------------------------

CREATE POLICY "Admins can view all notification preferences"
  ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 3.2  capability_domain_notes + capability_question_notes
--      Coaches can view shared notes but instructors cannot.
--      capability_snapshots already updated (20260204) to include instructor
--      access via shared_with_instructor. Notes tables need the same.
-- ---------------------------------------------------------------------------

CREATE POLICY "Instructors can view shared client domain notes"
  ON public.capability_domain_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots cs
      WHERE cs.id = capability_domain_notes.snapshot_id
        AND cs.shared_with_instructor = true
        AND cs.is_private = false
        AND has_role(auth.uid(), 'instructor'::app_role)
        AND staff_has_client_relationship(auth.uid(), cs.user_id)
    )
  );

CREATE POLICY "Instructors can view shared client question notes"
  ON public.capability_question_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots cs
      WHERE cs.id = capability_question_notes.snapshot_id
        AND cs.shared_with_instructor = true
        AND cs.is_private = false
        AND has_role(auth.uid(), 'instructor'::app_role)
        AND staff_has_client_relationship(auth.uid(), cs.user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3.3  cohort_sessions — No coach policy
--      Instructors can view sessions for their cohorts via program_instructors
--      but coaches (via program_coaches) have no equivalent policy.
-- ---------------------------------------------------------------------------

CREATE POLICY "Coaches can view sessions for their cohorts"
  ON public.cohort_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.program_cohorts pc
      JOIN public.program_coaches pco ON pco.program_id = pc.program_id
      WHERE pc.id = cohort_sessions.cohort_id
        AND pco.coach_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3.4  assessment_interest_registrations — Users can't update/delete own
--      Users can SELECT + INSERT but cannot UPDATE or DELETE their own
--      registrations (e.g., to cancel interest).
-- ---------------------------------------------------------------------------

CREATE POLICY "Users can update own assessment interest registrations"
  ON public.assessment_interest_registrations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assessment interest registrations"
  ON public.assessment_interest_registrations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3.5  user_assessments — Admin lacks UPDATE/DELETE
--      Admin has SELECT-only policy. Replace with ALL for full management.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can view all assessments" ON public.user_assessments;

CREATE POLICY "Admins can manage all assessments"
  ON public.user_assessments
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

