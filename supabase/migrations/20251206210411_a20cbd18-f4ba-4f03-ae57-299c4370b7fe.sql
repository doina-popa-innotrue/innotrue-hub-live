-- Drop any existing permissive public SELECT policy on plan_features
DROP POLICY IF EXISTS "Everyone can view plan features" ON public.plan_features;
DROP POLICY IF EXISTS "Public can view plan features" ON public.plan_features;

-- Create new policy requiring authentication for SELECT
CREATE POLICY "Authenticated users can view plan features" 
ON public.plan_features 
FOR SELECT 
USING (auth.uid() IS NOT NULL);