-- =============================================================================
-- Migration: RLS Fix — CRITICAL Priority
-- =============================================================================
-- Fixes data access failures identified in comprehensive RLS audit (2026-02-12)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.1  ac_signup_intents — Add authenticated INSERT + UPDATE
--      WheelAssessment.tsx (public page) performs INSERT/UPDATE but only
--      admin ALL policy exists. The page uses authenticated supabase client.
-- ---------------------------------------------------------------------------

CREATE POLICY "Authenticated users can create signup intents"
  ON public.ac_signup_intents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update own signup intents"
  ON public.ac_signup_intents
  FOR UPDATE
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Authenticated users can view own signup intents"
  ON public.ac_signup_intents
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 1.2  module_progress — Restore module-level instructor/coach SELECT access
--      Migration 20251214 accidentally removed module_instructors and
--      module_coaches access. Only program-level remains.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view progress they have access to" ON public.module_progress;

CREATE POLICY "Users can view progress they have access to"
  ON public.module_progress
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Client can view their own progress
    EXISTS (
      SELECT 1 FROM client_enrollments
      WHERE client_enrollments.id = module_progress.enrollment_id
        AND client_enrollments.client_user_id = auth.uid()
    )
    OR
    -- Primary instructor at program level
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_instructors pi ON pi.program_id = ce.program_id
      WHERE ce.id = module_progress.enrollment_id
        AND pi.instructor_id = auth.uid()
        AND pi.is_primary = true
    )
    OR
    -- Coach at program level
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_coaches pc ON pc.program_id = ce.program_id
      WHERE ce.id = module_progress.enrollment_id
        AND pc.coach_id = auth.uid()
    )
    OR
    -- Module-level instructor (RESTORED)
    EXISTS (
      SELECT 1 FROM module_instructors mi
      WHERE mi.module_id = module_progress.module_id
        AND mi.instructor_id = auth.uid()
    )
    OR
    -- Module-level coach (RESTORED)
    EXISTS (
      SELECT 1 FROM module_coaches mc
      WHERE mc.module_id = module_progress.module_id
        AND mc.coach_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 1.3  client_enrollments — Add staff SELECT for staff_enrollments view
--      The staff_enrollments view uses security_invoker = on, so it inherits
--      the caller's RLS context. Staff need SELECT on client_enrollments.
-- ---------------------------------------------------------------------------

CREATE POLICY "Staff can view enrollments for their programs"
  ON public.client_enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_instructors pi
      WHERE pi.program_id = client_enrollments.program_id
        AND pi.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM program_coaches pc
      WHERE pc.program_id = client_enrollments.program_id
        AND pc.coach_id = auth.uid()
    )
  );
