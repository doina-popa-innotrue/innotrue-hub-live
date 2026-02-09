-- Drop existing restrictive policy on program_modules
DROP POLICY IF EXISTS "Users can view modules they have access to" ON public.program_modules;

-- Create new policy: users can view modules for active programs, or programs where they are admin/instructor/coach
CREATE POLICY "Users can view modules for active programs"
ON public.program_modules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.programs
    WHERE programs.id = program_modules.program_id
    AND (programs.is_active = true OR has_role(auth.uid(), 'admin'::app_role))
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.module_instructors
    WHERE module_instructors.module_id = program_modules.id
    AND module_instructors.instructor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.module_coaches
    WHERE module_coaches.module_id = program_modules.id
    AND module_coaches.coach_id = auth.uid()
  )
);