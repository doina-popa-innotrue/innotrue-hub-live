-- Break recursive RLS between goals and goal_shares
-- The recursion happens because:
-- 1) goals SELECT policy checks goal_shares
-- 2) goal_shares ALL policy checks goals
-- When querying goals, RLS evaluation bounces between these two tables.

-- Adjust goal_shares policy so it no longer references goals
DROP POLICY IF EXISTS "Goal owners can manage their shares" ON public.goal_shares;

-- New policy: creators (and admins) can manage shares they created, without
-- looking up ownership via the goals table, avoiding cross-table recursion.
CREATE POLICY "Goal creators can manage their shares"
ON public.goal_shares
FOR ALL
USING (
  shared_by_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  shared_by_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
