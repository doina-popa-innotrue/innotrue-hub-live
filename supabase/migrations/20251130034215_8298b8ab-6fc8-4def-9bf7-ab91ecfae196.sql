-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view programs they have access to" ON public.programs;

-- Create new policy: all authenticated users can see active programs, admins can see all
CREATE POLICY "All users can view active programs, admins can view all"
ON public.programs
FOR SELECT
TO authenticated
USING (
  is_active = true OR has_role(auth.uid(), 'admin'::app_role)
);