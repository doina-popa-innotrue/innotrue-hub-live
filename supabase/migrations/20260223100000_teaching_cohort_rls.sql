-- GT1: Teaching Cohort Workflow — RLS policies for instructor/coach access
-- Makes both instructors AND coaches have symmetric access to cohort management

-- 1. Coach SELECT on program_cohorts (instructors already have this via existing policy; coaches don't)
CREATE POLICY "Coaches can view cohorts for their programs"
  ON public.program_cohorts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.program_coaches pc
    WHERE pc.program_id = program_cohorts.program_id AND pc.coach_id = auth.uid()
  ));

-- 2. Instructor UPDATE on cohort_sessions (currently SELECT only — need UPDATE for recap editing)
CREATE POLICY "Instructors can update sessions for their cohorts"
  ON public.cohort_sessions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.program_cohorts pc
    JOIN public.program_instructors pi ON pi.program_id = pc.program_id
    WHERE pc.id = cohort_sessions.cohort_id AND pi.instructor_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.program_cohorts pc
    JOIN public.program_instructors pi ON pi.program_id = pc.program_id
    WHERE pc.id = cohort_sessions.cohort_id AND pi.instructor_id = auth.uid()
  ));

-- 3. Coach UPDATE on cohort_sessions (same scope — coaches also need recap editing)
CREATE POLICY "Coaches can update sessions for their cohorts"
  ON public.cohort_sessions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.program_cohorts pc
    JOIN public.program_coaches pco ON pco.program_id = pc.program_id
    WHERE pc.id = cohort_sessions.cohort_id AND pco.coach_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.program_cohorts pc
    JOIN public.program_coaches pco ON pco.program_id = pc.program_id
    WHERE pc.id = cohort_sessions.cohort_id AND pco.coach_id = auth.uid()
  ));

-- 4. Upgrade coach attendance from SELECT-only to full CRUD (instructors already have ALL)
DROP POLICY IF EXISTS "Coaches can view attendance for their programs" ON public.cohort_session_attendance;
CREATE POLICY "Coaches can manage attendance for their sessions"
  ON public.cohort_session_attendance FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cohort_sessions cs
    JOIN public.program_cohorts pc ON pc.id = cs.cohort_id
    JOIN public.program_coaches pco ON pco.program_id = pc.program_id
    WHERE cs.id = cohort_session_attendance.session_id AND pco.coach_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cohort_sessions cs
    JOIN public.program_cohorts pc ON pc.id = cs.cohort_id
    JOIN public.program_coaches pco ON pco.program_id = pc.program_id
    WHERE cs.id = cohort_session_attendance.session_id AND pco.coach_id = auth.uid()
  ));
