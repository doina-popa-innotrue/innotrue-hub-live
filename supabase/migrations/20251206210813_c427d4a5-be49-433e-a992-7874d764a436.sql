-- Fix 1: Restrict platform_terms to authenticated users only
DROP POLICY IF EXISTS "Everyone can view platform terms" ON public.platform_terms;
DROP POLICY IF EXISTS "Public can view platform terms" ON public.platform_terms;

CREATE POLICY "Authenticated users can view current platform terms" 
ON public.platform_terms 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix 2: Add explicit policies to signup_verification_requests
-- This table should only be accessed by service role (edge functions)
-- No client-side access should be allowed
DROP POLICY IF EXISTS "Users can view own verification requests" ON public.signup_verification_requests;
DROP POLICY IF EXISTS "Anyone can view verification requests" ON public.signup_verification_requests;

-- Ensure RLS is enabled (no policies = service role only access)
ALTER TABLE IF EXISTS public.signup_verification_requests ENABLE ROW LEVEL SECURITY;