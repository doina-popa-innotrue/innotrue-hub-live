-- Add policy to allow group members to update sessions they created or any session if they're a member
-- This allows peer groups to self-organize session details like meeting links

CREATE POLICY "Group members can update sessions"
ON public.group_sessions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM group_memberships
    WHERE group_memberships.group_id = group_sessions.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'::group_membership_status
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_memberships
    WHERE group_memberships.group_id = group_sessions.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'::group_membership_status
  )
);