-- Drop the existing permissive public SELECT policy
DROP POLICY IF EXISTS "Everyone can view features" ON public.features;

-- Create new policy requiring authentication for SELECT
CREATE POLICY "Authenticated users can view features" 
ON public.features 
FOR SELECT 
USING (auth.uid() IS NOT NULL);