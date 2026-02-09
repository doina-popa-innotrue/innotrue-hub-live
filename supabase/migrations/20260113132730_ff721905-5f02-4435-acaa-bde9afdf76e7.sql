-- Create a security definer function to check if a user is a program instructor/coach
CREATE OR REPLACE FUNCTION public.is_program_instructor_or_coach(_user_id uuid, _program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM program_instructors 
    WHERE program_id = _program_id AND instructor_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM program_coaches 
    WHERE program_id = _program_id AND coach_id = _user_id
  )
$$;

-- Create a security definer function to get program_id from module_id
CREATE OR REPLACE FUNCTION public.get_program_id_from_module(_module_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT program_id FROM program_modules WHERE id = _module_id LIMIT 1
$$;

-- Drop the existing instructor policy that causes issues
DROP POLICY IF EXISTS "Instructors can manage sessions for their modules" ON public.module_sessions;

-- Create a new policy that checks both module-level and program-level assignments
CREATE POLICY "Instructors can manage sessions for their modules"
ON public.module_sessions
FOR ALL
USING (
  -- Module-level assignment
  EXISTS (
    SELECT 1 FROM module_instructors mi
    WHERE mi.module_id = module_sessions.module_id AND mi.instructor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM module_coaches mc
    WHERE mc.module_id = module_sessions.module_id AND mc.coach_id = auth.uid()
  )
  -- Program-level assignment (using security definer function to avoid recursion)
  OR public.is_program_instructor_or_coach(auth.uid(), public.get_program_id_from_module(module_sessions.module_id))
  OR public.is_program_instructor_or_coach(auth.uid(), module_sessions.program_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM module_instructors mi
    WHERE mi.module_id = module_sessions.module_id AND mi.instructor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM module_coaches mc
    WHERE mc.module_id = module_sessions.module_id AND mc.coach_id = auth.uid()
  )
  OR public.is_program_instructor_or_coach(auth.uid(), public.get_program_id_from_module(module_sessions.module_id))
  OR public.is_program_instructor_or_coach(auth.uid(), module_sessions.program_id)
);