-- Drop existing SELECT policies on groups to consolidate them
DROP POLICY IF EXISTS "Admins can view all groups" ON public.groups;
DROP POLICY IF EXISTS "Group members can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view open groups" ON public.groups;

-- Create a single consolidated SELECT policy
CREATE POLICY "Users can view groups"
ON public.groups
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  is_group_member(auth.uid(), id) OR
  (join_type = 'open'::group_join_type AND status = 'active'::group_status)
);