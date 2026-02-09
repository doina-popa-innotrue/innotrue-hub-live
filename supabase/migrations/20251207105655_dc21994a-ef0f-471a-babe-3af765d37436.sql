
-- Fix 1: Add RLS policy to signup_verification_requests to block all client access
-- (Server-side access via service role key will still work)
CREATE POLICY "No client access to signup verification requests"
ON public.signup_verification_requests
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Fix 2: Remove plaintext token columns from oauth_tokens
-- First, ensure the encrypted columns exist (they should from previous migration)
-- Then drop the plaintext columns
ALTER TABLE public.oauth_tokens 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token;
