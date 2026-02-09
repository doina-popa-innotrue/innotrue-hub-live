
-- Allow clients to view the scheduling_url of instructors/coaches assigned to their programs
-- This enables the hierarchical Cal.com scheduling URL resolution

CREATE POLICY "Clients can view profiles of their program staff"
ON public.profiles
FOR SELECT
USING (
  -- User can see profiles of instructors assigned to their enrolled programs
  EXISTS (
    SELECT 1 
    FROM client_enrollments ce
    JOIN program_instructors pi ON pi.program_id = ce.program_id
    WHERE ce.client_user_id = auth.uid()
      AND ce.status IN ('active', 'paused', 'completed')
      AND pi.instructor_id = profiles.id
  )
  OR
  -- User can see profiles of coaches assigned to their enrolled programs
  EXISTS (
    SELECT 1 
    FROM client_enrollments ce
    JOIN program_coaches pc ON pc.program_id = ce.program_id
    WHERE ce.client_user_id = auth.uid()
      AND ce.status IN ('active', 'paused', 'completed')
      AND pc.coach_id = profiles.id
  )
  OR
  -- User can see profiles of module-level instructors for their enrolled programs
  EXISTS (
    SELECT 1 
    FROM client_enrollments ce
    JOIN program_modules pm ON pm.program_id = ce.program_id
    JOIN module_instructors mi ON mi.module_id = pm.id
    WHERE ce.client_user_id = auth.uid()
      AND ce.status IN ('active', 'paused', 'completed')
      AND mi.instructor_id = profiles.id
  )
  OR
  -- User can see profiles of module-level coaches for their enrolled programs  
  EXISTS (
    SELECT 1 
    FROM client_enrollments ce
    JOIN program_modules pm ON pm.program_id = ce.program_id
    JOIN module_coaches mc ON mc.module_id = pm.id
    WHERE ce.client_user_id = auth.uid()
      AND ce.status IN ('active', 'paused', 'completed')
      AND mc.coach_id = profiles.id
  )
  OR
  -- User can see profiles of staff assigned to their specific enrollment
  EXISTS (
    SELECT 1 
    FROM client_enrollments ce
    JOIN enrollment_module_staff ems ON ems.enrollment_id = ce.id
    WHERE ce.client_user_id = auth.uid()
      AND ce.status IN ('active', 'paused', 'completed')
      AND (ems.instructor_id = profiles.id OR ems.coach_id = profiles.id)
  )
);
