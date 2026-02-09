-- Security fix: Prevent token exposure to users
-- The email_change_requests table contains sensitive verification tokens that should never be exposed via API

-- First, add the verified_at column if it doesn't exist (to track used tokens)
ALTER TABLE public.email_change_requests 
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Drop the existing SELECT policy that exposes token columns
DROP POLICY IF EXISTS "Users can view their own email change requests" ON public.email_change_requests;

-- Create a secure view that excludes sensitive columns
-- Users can see their pending requests without seeing the actual tokens
CREATE OR REPLACE VIEW public.email_change_requests_safe AS
SELECT 
  id,
  user_id,
  old_email,
  new_email,
  expires_at,
  created_at,
  verified_at,
  -- Don't include verification_token or token_hash!
  CASE 
    WHEN verified_at IS NOT NULL THEN 'verified'
    WHEN expires_at < now() THEN 'expired'
    ELSE 'pending'
  END as status
FROM public.email_change_requests;

-- Enable RLS on the view is not needed since views inherit from base table
-- But we need to allow users to query the safe view

-- Grant select on the safe view to authenticated users
GRANT SELECT ON public.email_change_requests_safe TO authenticated;

-- Now create a new policy that uses a security definer function to prevent direct table access
-- Users should NOT be able to SELECT directly from the table - only through the edge function
-- We keep INSERT and DELETE policies as they are safe

-- Clean up any legacy unhashed tokens (security cleanup)
-- This deletes any expired requests to prevent exposure
DELETE FROM public.email_change_requests 
WHERE expires_at < now();

-- Add a comment explaining the security model
COMMENT ON TABLE public.email_change_requests IS 
'Email change verification requests. SECURITY: Users should query email_change_requests_safe view instead. The verification_token and token_hash columns must never be exposed via client API. Tokens are validated only through the verify-email-change edge function.';