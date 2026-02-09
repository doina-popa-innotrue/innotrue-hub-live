-- Allow users to view peer assessments they've received from group members
-- This checks if both users are in the same group
CREATE OR REPLACE FUNCTION public.are_group_peers(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_memberships gm1
    JOIN group_memberships gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = user_a
      AND gm2.user_id = user_b
      AND gm1.status = 'active'
      AND gm2.status = 'active'
      AND gm1.user_id != gm2.user_id
  )
$$;

-- Allow users to view peer assessments where they are the subject
CREATE POLICY "Users can view peer assessments received"
  ON public.capability_snapshots FOR SELECT
  USING (
    user_id = auth.uid() 
    AND is_self_assessment = false 
    AND evaluation_relationship = 'peer'
  );

COMMENT ON FUNCTION public.are_group_peers IS 'Checks if two users are members of the same group';