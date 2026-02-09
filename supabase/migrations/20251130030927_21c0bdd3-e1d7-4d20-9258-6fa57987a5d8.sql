-- Fix infinite recursion in goals table RLS policies
-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their own goals" ON public.goals;
DROP POLICY IF EXISTS "Admins can view all goals" ON public.goals;
DROP POLICY IF EXISTS "Shared users can view goals shared with them" ON public.goals;

-- Recreate SELECT policies without recursion
CREATE POLICY "Users can view their own goals"
ON public.goals
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all goals"
ON public.goals
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shared users can view goals shared with them"
ON public.goals
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.goal_shares
    WHERE goal_shares.goal_id = goals.id
    AND goal_shares.shared_with_user_id = auth.uid()
  )
);