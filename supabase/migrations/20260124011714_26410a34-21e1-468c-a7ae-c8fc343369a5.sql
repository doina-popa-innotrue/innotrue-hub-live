-- Fix credit_source_types public exposure by removing the overly permissive policy
-- This table contains credit system architecture that should not be publicly visible

DROP POLICY IF EXISTS "Anyone can read credit source types" ON public.credit_source_types;

-- Keep only the admin policies:
-- "Admins can manage credit source types" - allows admin full CRUD
-- "Only admins can view credit source types" - already exists for SELECT

-- Also add policy for authenticated users to view (they need this for the credit system UI)
-- but not for anonymous/public access
CREATE POLICY "Authenticated users can view credit source types"
ON public.credit_source_types
FOR SELECT
USING (auth.uid() IS NOT NULL);