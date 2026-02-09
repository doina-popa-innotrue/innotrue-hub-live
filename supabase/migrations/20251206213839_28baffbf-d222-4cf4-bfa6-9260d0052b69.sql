-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view memberships of their groups" ON public.group_memberships;

-- Create a security definer function to check group membership without recursion
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_memberships
    WHERE user_id = _user_id
      AND group_id = _group_id
      AND status = 'active'
  )
$$;

-- Create new non-recursive policy using the security definer function
CREATE POLICY "Users can view memberships of their groups"
ON public.group_memberships
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_group_member(auth.uid(), group_id)
  OR public.has_role(auth.uid(), 'admin')
);