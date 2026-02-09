-- Drop the existing public access policy
DROP POLICY IF EXISTS "Everyone can view active plans" ON public.plans;

-- Create a new policy that restricts access to authenticated users only
CREATE POLICY "Authenticated users can view active plans" 
ON public.plans 
FOR SELECT 
USING (is_active = true AND auth.uid() IS NOT NULL);