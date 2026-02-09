-- RLS policies for groups table
-- Admins can view all groups
CREATE POLICY "Admins can view all groups"
  ON public.groups
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can create groups
CREATE POLICY "Admins can create groups"
  ON public.groups
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update groups
CREATE POLICY "Admins can update groups"
  ON public.groups
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete groups
CREATE POLICY "Admins can delete groups"
  ON public.groups
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Group members can view their groups
CREATE POLICY "Group members can view their groups"
  ON public.groups
  FOR SELECT
  USING (is_group_member(auth.uid(), id));

-- RLS policies for group_memberships table
-- Admins can manage all memberships
CREATE POLICY "Admins can view all memberships"
  ON public.group_memberships
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create memberships"
  ON public.group_memberships
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update memberships"
  ON public.group_memberships
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete memberships"
  ON public.group_memberships
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own membership
CREATE POLICY "Users can view own membership"
  ON public.group_memberships
  FOR SELECT
  USING (user_id = auth.uid());