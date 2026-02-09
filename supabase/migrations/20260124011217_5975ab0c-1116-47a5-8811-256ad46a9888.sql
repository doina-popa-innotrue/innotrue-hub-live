-- Clean up duplicate and inconsistent RLS policies on capability_snapshots

-- Remove duplicate admin policy
DROP POLICY IF EXISTS "Admins can view all snapshots" ON public.capability_snapshots;

-- Remove the coach policy that doesn't check is_private (the other one does and is correct)
DROP POLICY IF EXISTS "Coaches can view shared client snapshots" ON public.capability_snapshots;

-- The remaining policies are correct:
-- "Admins can view all capability snapshots" - allows admin full access
-- "Assigned coaches can view shared non-private assessments" - properly checks is_private=false AND shared_with_coach=true
-- "Assigned instructors can view shared non-private assessments" - properly checks is_private=false AND shared_with_instructor=true
-- "Evaluators can view their evaluations" - allows evaluators to see assessments they gave
-- "Users can view own capability snapshots" - allows users to see their own
-- "Users can view peer assessments received" - allows users to see peer assessments about them