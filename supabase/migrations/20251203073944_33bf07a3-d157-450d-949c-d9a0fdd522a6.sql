-- Allow coaches/instructors to view reflections of their assigned clients' modules
CREATE POLICY "Coaches can view client reflections"
ON public.module_reflections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM module_progress mp
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    JOIN client_coaches cc ON cc.client_id = ce.client_user_id
    WHERE mp.id = module_reflections.module_progress_id
    AND cc.coach_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM module_progress mp
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    JOIN program_instructors pi ON pi.program_id = ce.program_id
    WHERE mp.id = module_reflections.module_progress_id
    AND pi.instructor_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM module_progress mp
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    JOIN program_coaches pc ON pc.program_id = ce.program_id
    WHERE mp.id = module_reflections.module_progress_id
    AND pc.coach_id = auth.uid()
  )
);

-- Allow instructors to view feedback (in case they want to see what coaches wrote)
CREATE POLICY "Instructors can view feedback on their program modules"
ON public.coach_module_feedback
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM module_progress mp
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    JOIN program_instructors pi ON pi.program_id = ce.program_id
    WHERE mp.id = coach_module_feedback.module_progress_id
    AND pi.instructor_id = auth.uid()
  )
);

-- Allow instructors to also add feedback (treating them similarly to coaches for feedback purposes)
CREATE POLICY "Instructors can insert feedback"
ON public.coach_module_feedback
FOR INSERT
WITH CHECK (
  auth.uid() = coach_id AND (
    has_role(auth.uid(), 'instructor'::app_role) OR has_role(auth.uid(), 'coach'::app_role)
  )
);

-- Allow instructors to update their own feedback
CREATE POLICY "Instructors can update their own feedback"
ON public.coach_module_feedback
FOR UPDATE
USING (auth.uid() = coach_id AND has_role(auth.uid(), 'instructor'::app_role))
WITH CHECK (auth.uid() = coach_id);

-- Allow instructors to delete their own feedback
CREATE POLICY "Instructors can delete their own feedback"
ON public.coach_module_feedback
FOR DELETE
USING (auth.uid() = coach_id AND has_role(auth.uid(), 'instructor'::app_role));