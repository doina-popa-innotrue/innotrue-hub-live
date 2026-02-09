-- Fix credit_source_types exposure - restrict to admin only
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view credit source types" ON public.credit_source_types;
DROP POLICY IF EXISTS "Authenticated users can view credit source types" ON public.credit_source_types;

-- Create admin-only policy
CREATE POLICY "Only admins can view credit source types" 
ON public.credit_source_types 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));