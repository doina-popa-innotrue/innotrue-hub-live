-- Fix: Use security_invoker instead of security_definer for the view
-- This ensures the view respects the RLS policies of the querying user

DROP VIEW IF EXISTS public.email_change_requests_safe;

CREATE VIEW public.email_change_requests_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  old_email,
  new_email,
  expires_at,
  created_at,
  verified_at,
  CASE 
    WHEN verified_at IS NOT NULL THEN 'verified'
    WHEN expires_at < now() THEN 'expired'
    ELSE 'pending'
  END as status
FROM public.email_change_requests
WHERE user_id = auth.uid();  -- Users can only see their own requests

-- Re-grant select on the safe view
GRANT SELECT ON public.email_change_requests_safe TO authenticated;

-- Add RLS policy on the base table that allows SELECT but only for service role
-- This prevents direct table access while allowing the edge function to work
CREATE POLICY "Service role only for SELECT"
ON public.email_change_requests
FOR SELECT
TO authenticated
USING (false);  -- Deny all authenticated SELECT - edge function uses service role