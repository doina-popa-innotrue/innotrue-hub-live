-- Update RLS policies to use is_group_member function instead of direct EXISTS
-- This avoids potential RLS recursion issues

-- group_member_links
DROP POLICY IF EXISTS "Group members can view group links" ON public.group_member_links;
CREATE POLICY "Group members can view group links" ON public.group_member_links
  FOR SELECT USING (is_group_member(auth.uid(), group_id));

DROP POLICY IF EXISTS "Group members can create their own links" ON public.group_member_links;
CREATE POLICY "Group members can create their own links" ON public.group_member_links
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_group_member(auth.uid(), group_id));

-- group_notes
DROP POLICY IF EXISTS "Group members can view group notes" ON public.group_notes;
CREATE POLICY "Group members can view group notes" ON public.group_notes
  FOR SELECT USING (is_group_member(auth.uid(), group_id));

DROP POLICY IF EXISTS "Group members can create group notes" ON public.group_notes;
CREATE POLICY "Group members can create group notes" ON public.group_notes
  FOR INSERT WITH CHECK (is_group_member(auth.uid(), group_id));

DROP POLICY IF EXISTS "Group members can update group notes" ON public.group_notes;
CREATE POLICY "Group members can update group notes" ON public.group_notes
  FOR UPDATE USING (is_group_member(auth.uid(), group_id));

-- group_tasks
DROP POLICY IF EXISTS "Group members can view group tasks" ON public.group_tasks;
CREATE POLICY "Group members can view group tasks" ON public.group_tasks
  FOR SELECT USING (is_group_member(auth.uid(), group_id));

DROP POLICY IF EXISTS "Group members can create group tasks" ON public.group_tasks;
CREATE POLICY "Group members can create group tasks" ON public.group_tasks
  FOR INSERT WITH CHECK (is_group_member(auth.uid(), group_id));

DROP POLICY IF EXISTS "Group members can update group tasks" ON public.group_tasks;
CREATE POLICY "Group members can update group tasks" ON public.group_tasks
  FOR UPDATE USING (is_group_member(auth.uid(), group_id));

-- group_check_ins
DROP POLICY IF EXISTS "Group members can view check-ins" ON public.group_check_ins;
CREATE POLICY "Group members can view check-ins" ON public.group_check_ins
  FOR SELECT USING (is_group_member(auth.uid(), group_id));

DROP POLICY IF EXISTS "Users can create their own check-ins" ON public.group_check_ins;
CREATE POLICY "Group members can create check-ins" ON public.group_check_ins
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_group_member(auth.uid(), group_id));