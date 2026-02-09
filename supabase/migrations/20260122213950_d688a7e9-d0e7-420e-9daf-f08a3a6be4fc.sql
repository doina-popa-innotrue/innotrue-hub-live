-- Fix: Restrict staff profile access to only their assigned clients

-- 1. Drop the overly permissive staff policy
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;

-- 2. Create new restrictive policy using the existing relationship check function
CREATE POLICY "Staff can view assigned client profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Staff can only see profiles of clients they have a relationship with
  (
    (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'instructor'::app_role))
    AND
    staff_has_client_relationship(auth.uid(), id)
  )
);

-- Note: Admins still have full access via "Admins can view all profiles" policy
-- Note: Users can still see their own profile via "Users can view own profile" policy
-- Note: Group members can still see each other via "Users can view profiles of group members" policy