-- Fix infinite recursion in group_session_participants RLS policy
-- The SELECT policy was self-referencing, causing infinite recursion

-- Drop the problematic policy  
DROP POLICY IF EXISTS "Users can view group session participants" ON public.group_session_participants;

-- Create a fixed SELECT policy that doesn't self-reference
-- Users can see participants if:
-- 1. They are the participant themselves
-- 2. They are a member of the same group (via group_memberships table)
-- 3. They are admin/instructor/coach
CREATE POLICY "Users can view group session participants"
  ON public.group_session_participants
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.group_memberships gm
      WHERE gm.group_id = group_session_participants.group_id
      AND gm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'instructor'::app_role, 'coach'::app_role])
    )
  );