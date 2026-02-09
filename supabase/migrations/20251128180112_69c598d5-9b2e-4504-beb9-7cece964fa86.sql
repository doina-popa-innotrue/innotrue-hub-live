-- Drop the existing broad policy that allows all authenticated users to view programs
DROP POLICY IF EXISTS "Authenticated users can view active programs" ON programs;

-- Create new restrictive policy: only enrolled users and admins can view programs
CREATE POLICY "Users can view programs they are enrolled in" 
ON programs 
FOR SELECT 
USING (
  -- Admins can view all programs
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  -- Users can only view programs they are enrolled in
  EXISTS (
    SELECT 1 
    FROM client_enrollments 
    WHERE client_enrollments.program_id = programs.id 
      AND client_enrollments.client_user_id = auth.uid()
  )
);