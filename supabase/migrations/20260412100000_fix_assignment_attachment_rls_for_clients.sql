-- Fix: clients (assignment owners) could not INSERT/DELETE attachments on their
-- own module assignments. The original policies only allowed admins and assessors.
-- Add a policy for the enrolled client who owns the assignment.

CREATE POLICY "Assignment owners can manage their attachments"
ON public.module_assignment_attachments FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM module_assignments ma
    JOIN module_progress mp ON mp.id = ma.module_progress_id
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    WHERE ma.id = module_assignment_attachments.assignment_id
      AND ce.client_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM module_assignments ma
    JOIN module_progress mp ON mp.id = ma.module_progress_id
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    WHERE ma.id = module_assignment_attachments.assignment_id
      AND ce.client_user_id = auth.uid()
  )
);
