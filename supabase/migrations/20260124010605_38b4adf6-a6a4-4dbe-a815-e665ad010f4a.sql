-- Fix overly permissive INSERT policy on signup_contexts table
-- The existing policy "Service role can insert signup contexts" uses WITH CHECK (true)
-- which allows any authenticated user to insert records for ANY user_id

-- Drop the problematic policy
DROP POLICY IF EXISTS "Service role can insert signup contexts" ON public.signup_contexts;

-- Create a proper policy that ensures:
-- 1. Authenticated users can only insert records with their own user_id
-- 2. Admins can insert records for any user (for admin-initiated enrollments)
CREATE POLICY "Users can insert their own signup context" 
ON public.signup_contexts 
FOR INSERT 
WITH CHECK (
    -- Users can only insert their own signup context
    auth.uid() = user_id
    -- Or admins can insert for any user
    OR public.has_role(auth.uid(), 'admin')
);