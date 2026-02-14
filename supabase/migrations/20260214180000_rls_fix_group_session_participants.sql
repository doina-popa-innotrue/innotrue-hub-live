-- =============================================================================
-- Migration: RLS Fix — group_session_participants staff scoping (#2.8)
-- =============================================================================
-- Problem: Any instructor/coach can view ALL group session participants
--          platform-wide, not just their own groups.
-- Fix: Keep admin broad access. Scope instructor/coach SELECT to groups
--      they are members of (same group_memberships check already used for
--      regular users). This preserves the existing behaviour where group
--      members (including staff assigned to the group) see participants,
--      while preventing unrelated staff from seeing other groups' data.
-- =============================================================================

DROP POLICY IF EXISTS "Users can view group session participants" ON public.group_session_participants;

CREATE POLICY "Users can view group session participants"
  ON public.group_session_participants
  FOR SELECT
  USING (
    -- 1. User IS the participant
    auth.uid() = user_id
    -- 2. User is a member of the same group (covers both clients AND staff assigned to the group)
    OR EXISTS (
      SELECT 1 FROM public.group_memberships gm
      WHERE gm.group_id = group_session_participants.group_id
      AND gm.user_id = auth.uid()
    )
    -- 3. Admin can see all
    OR has_role(auth.uid(), 'admin'::app_role)
  );
