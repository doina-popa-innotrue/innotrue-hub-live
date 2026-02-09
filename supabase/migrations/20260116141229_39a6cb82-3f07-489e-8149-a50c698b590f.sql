-- Update RLS policies for external_courses to respect is_private
DROP POLICY IF EXISTS "Assigned coaches can view client courses" ON public.external_courses;
DROP POLICY IF EXISTS "Assigned instructors can view client courses" ON public.external_courses;

CREATE POLICY "Assigned coaches can view client non-private courses"
ON public.external_courses FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_coaches cc
    WHERE cc.client_id = external_courses.user_id
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Assigned instructors can view client non-private courses"
ON public.external_courses FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_instructors ci
    WHERE ci.client_id = external_courses.user_id
    AND ci.instructor_id = auth.uid()
  )
);

-- Update RLS policies for module_assignments to respect is_private
DROP POLICY IF EXISTS "Coaches can view client assignments" ON public.module_assignments;
DROP POLICY IF EXISTS "Instructors can view client assignments" ON public.module_assignments;

CREATE POLICY "Coaches can view client non-private assignments"
ON public.module_assignments FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.module_progress mp
    JOIN public.client_enrollments ce ON ce.id = mp.enrollment_id
    JOIN public.client_coaches cc ON cc.client_id = ce.client_user_id
    WHERE mp.id = module_assignments.module_progress_id
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Instructors can view client non-private assignments"
ON public.module_assignments FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.module_progress mp
    JOIN public.client_enrollments ce ON ce.id = mp.enrollment_id
    JOIN public.client_instructors ci ON ci.client_id = ce.client_user_id
    WHERE mp.id = module_assignments.module_progress_id
    AND ci.instructor_id = auth.uid()
  )
);

-- Update RLS policies for user_skills to respect is_private
DROP POLICY IF EXISTS "Coaches can view client skills" ON public.user_skills;
DROP POLICY IF EXISTS "Instructors can view client skills" ON public.user_skills;

CREATE POLICY "Coaches can view client non-private skills"
ON public.user_skills FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_coaches cc
    WHERE cc.client_id = user_skills.user_id
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Instructors can view client non-private skills"
ON public.user_skills FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_instructors ci
    WHERE ci.client_id = user_skills.user_id
    AND ci.instructor_id = auth.uid()
  )
);

-- Update RLS policies for client_badges to respect is_private
DROP POLICY IF EXISTS "Coaches can view client badges" ON public.client_badges;
DROP POLICY IF EXISTS "Instructors can view client badges" ON public.client_badges;

CREATE POLICY "Coaches can view client non-private badges"
ON public.client_badges FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_enrollments ce
    JOIN public.client_coaches cc ON cc.client_id = ce.client_user_id
    WHERE ce.id = client_badges.enrollment_id
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Instructors can view client non-private badges"
ON public.client_badges FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_enrollments ce
    JOIN public.client_instructors ci ON ci.client_id = ce.client_user_id
    WHERE ce.id = client_badges.enrollment_id
    AND ci.instructor_id = auth.uid()
  )
);