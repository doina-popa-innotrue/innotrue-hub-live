-- Fix the overly permissive RLS policy on organization_invites
-- Drop the current permissive policy
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.organization_invites;

-- Create a more restrictive policy that only allows viewing invites with matching token
-- This requires a function since we can't access query params in RLS directly
-- The invite lookup will be done via edge function with service role
-- For now, we'll restrict SELECT to authenticated users who are the invite recipient
CREATE POLICY "Users can view invites sent to their email"
ON public.organization_invites
FOR SELECT
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);