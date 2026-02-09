
-- Align capability_snapshots RLS policies to use staff_has_client_relationship
-- This ensures instructors/coaches at program or module level can also view assessments

-- 1. Drop existing restrictive policies for coaches and instructors
DROP POLICY IF EXISTS "Assigned coaches can view shared non-private assessments" ON capability_snapshots;
DROP POLICY IF EXISTS "Assigned instructors can view shared non-private assessments" ON capability_snapshots;

-- 2. Create unified policy using staff_has_client_relationship
CREATE POLICY "Staff can view shared non-private assessments"
ON capability_snapshots FOR SELECT
TO authenticated
USING (
  is_private = false
  AND (
    (shared_with_coach = true AND has_role(auth.uid(), 'coach'::app_role) AND staff_has_client_relationship(auth.uid(), user_id))
    OR
    (shared_with_instructor = true AND has_role(auth.uid(), 'instructor'::app_role) AND staff_has_client_relationship(auth.uid(), user_id))
  )
);

-- 3. Update capability_snapshot_ratings to also use staff_has_client_relationship
DROP POLICY IF EXISTS "Coaches can view shared client snapshot ratings" ON capability_snapshot_ratings;

CREATE POLICY "Staff can view shared client snapshot ratings"
ON capability_snapshot_ratings FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM capability_snapshots cs
    WHERE cs.id = capability_snapshot_ratings.snapshot_id
    AND cs.is_private = false
    AND (
      (cs.shared_with_coach = true AND has_role(auth.uid(), 'coach'::app_role) AND staff_has_client_relationship(auth.uid(), cs.user_id))
      OR
      (cs.shared_with_instructor = true AND has_role(auth.uid(), 'instructor'::app_role) AND staff_has_client_relationship(auth.uid(), cs.user_id))
    )
  )
);
