
-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view progress they have access to" ON public.module_progress;

-- Create a more restrictive SELECT policy
-- Only allows: 
-- 1. Admins (full access)
-- 2. The client themselves (their own progress)
-- 3. Primary instructors assigned to the program
-- 4. Coaches assigned to the program (all coaches are considered primary at program level)
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
  -- Primary instructor at program level can view all progress for their program
  EXISTS (
    SELECT 1 FROM client_enrollments ce
    JOIN program_instructors pi ON pi.program_id = ce.program_id
    WHERE ce.id = module_progress.enrollment_id 
    AND pi.instructor_id = auth.uid()
    AND pi.is_primary = true
  )
  OR 
  -- Coach at program level can view all progress for their program
  EXISTS (
    SELECT 1 FROM client_enrollments ce
    JOIN program_coaches pc ON pc.program_id = ce.program_id
    WHERE ce.id = module_progress.enrollment_id 
    AND pc.coach_id = auth.uid()
  )
);
