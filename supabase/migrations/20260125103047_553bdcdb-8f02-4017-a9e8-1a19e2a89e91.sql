-- Allow enrolled clients to view program instructors for programs they're enrolled in
CREATE POLICY "Enrolled clients can view program instructors"
ON public.program_instructors
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_enrollments ce
    WHERE ce.program_id = program_instructors.program_id
    AND ce.client_user_id = auth.uid()
    AND ce.status IN ('active', 'paused', 'completed')
  )
);

-- Allow enrolled clients to view program coaches for programs they're enrolled in
CREATE POLICY "Enrolled clients can view program coaches"
ON public.program_coaches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_enrollments ce
    WHERE ce.program_id = program_coaches.program_id
    AND ce.client_user_id = auth.uid()
    AND ce.status IN ('active', 'paused', 'completed')
  )
);