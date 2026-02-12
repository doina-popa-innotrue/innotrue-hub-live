-- =============================================================================
-- Migration: RLS Fix — Deferred Items
-- =============================================================================
-- Addresses remaining items from comprehensive RLS audit (2026-02-12)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.6  assessment_option_scores + assessment_interpretations
--      Public (anonymous) users can read scoring matrix and interpretation
--      thresholds, revealing how assessments are scored.
--      Fix: Replace public SELECT with authenticated-only SELECT.
--      Full server-side scoring refactor deferred to future sprint.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public can view option scores of active assessments" ON public.assessment_option_scores;

CREATE POLICY "Authenticated users can view option scores of active assessments"
  ON public.assessment_option_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assessment_options ao
      JOIN public.assessment_questions aq ON aq.id = ao.question_id
      JOIN public.assessment_definitions a ON a.id = aq.assessment_id
      WHERE ao.id = assessment_option_scores.option_id
        AND a.is_active = true
        AND a.is_public = true
    )
  );

DROP POLICY IF EXISTS "Public can view interpretations of active assessments" ON public.assessment_interpretations;

CREATE POLICY "Authenticated users can view interpretations of active assessments"
  ON public.assessment_interpretations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assessment_definitions a
      WHERE a.id = assessment_interpretations.assessment_id
        AND a.is_active = true
        AND a.is_public = true
    )
  );

-- ---------------------------------------------------------------------------
-- 2.7  sessions — Overly permissive staff ALL
--      Any instructor/coach has FOR ALL on ANY session record.
--      Fix: Scope to related sessions using is_session_instructor_or_coach().
--      This function already exists and checks all 5 relationship paths.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "s_all_instructor" ON public.sessions;
DROP POLICY IF EXISTS "s_all_coach" ON public.sessions;

CREATE POLICY "Instructors can manage their related sessions"
  ON public.sessions
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'instructor'::app_role)
    AND is_session_instructor_or_coach(id, auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'instructor'::app_role)
    AND is_session_instructor_or_coach(id, auth.uid())
  );

CREATE POLICY "Coaches can manage their related sessions"
  ON public.sessions
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    AND is_session_instructor_or_coach(id, auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'coach'::app_role)
    AND is_session_instructor_or_coach(id, auth.uid())
  );

-- Also scope session_module_links and session_group_links
DROP POLICY IF EXISTS "sml_all_instructor" ON public.session_module_links;
DROP POLICY IF EXISTS "sml_all_coach" ON public.session_module_links;

CREATE POLICY "Instructors can manage session-module links for their sessions"
  ON public.session_module_links
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'instructor'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'instructor'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  );

CREATE POLICY "Coaches can manage session-module links for their sessions"
  ON public.session_module_links
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'coach'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  );

DROP POLICY IF EXISTS "sgl_all_instructor" ON public.session_group_links;
DROP POLICY IF EXISTS "sgl_all_coach" ON public.session_group_links;

CREATE POLICY "Instructors can manage session-group links for their sessions"
  ON public.session_group_links
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'instructor'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'instructor'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  );

CREATE POLICY "Coaches can manage session-group links for their sessions"
  ON public.session_group_links
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'coach'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  );

-- session_participants — scope staff ALL
DROP POLICY IF EXISTS "sp_all_instructor" ON public.session_participants;
DROP POLICY IF EXISTS "sp_all_coach" ON public.session_participants;

CREATE POLICY "Instructors can manage participants for their sessions"
  ON public.session_participants
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'instructor'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'instructor'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  );

CREATE POLICY "Coaches can manage participants for their sessions"
  ON public.session_participants
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'coach'::app_role)
    AND is_session_instructor_or_coach(session_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3.11 resource_library_programs + resource_library_skills
--      RLS policies use old is_published column instead of new visibility model.
--      Fix: Update SELECT policies to use can_access_resource() or visibility.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view resource program links" ON public.resource_library_programs;

CREATE POLICY "Users can view resource program links"
  ON public.resource_library_programs
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR can_access_resource(auth.uid(), resource_id)
  );

DROP POLICY IF EXISTS "Anyone can read published resource skills" ON public.resource_library_skills;

CREATE POLICY "Users can view resource skills for accessible resources"
  ON public.resource_library_skills
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR can_access_resource(auth.uid(), resource_id)
  );
