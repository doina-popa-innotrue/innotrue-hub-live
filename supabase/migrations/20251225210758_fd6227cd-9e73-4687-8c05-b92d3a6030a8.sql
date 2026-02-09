-- Add a policy to allow viewing profiles for group members
-- This is needed for the embedded relationship queries to work properly
CREATE POLICY "Users can view profiles of group members in their groups"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT gm2.user_id 
    FROM group_memberships gm1
    JOIN group_memberships gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm1.status = 'active' AND gm2.status = 'active'
  )
);

-- Also add explicit SELECT for admins (in case the ALL policy isn't covering it properly)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));