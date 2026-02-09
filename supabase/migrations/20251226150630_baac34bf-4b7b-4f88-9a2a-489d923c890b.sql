-- Allow all group members to create sessions
DROP POLICY IF EXISTS "Group members can create sessions" ON public.group_sessions;
CREATE POLICY "Group members can create sessions" ON public.group_sessions
  FOR INSERT WITH CHECK (is_group_member(auth.uid(), group_id));