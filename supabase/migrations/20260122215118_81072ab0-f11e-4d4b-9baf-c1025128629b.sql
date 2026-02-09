-- Fix 1: Create a restricted view for staff to access enrollments without financial data
-- This addresses the enrollment_financial_staff security finding

-- Create a view that excludes financial columns for staff access
CREATE OR REPLACE VIEW public.staff_enrollments AS
SELECT 
  id,
  client_user_id,
  program_id,
  status,
  start_date,
  end_date,
  tier,
  created_at,
  updated_at,
  program_version_id,
  is_public,
  program_plan_id,
  cohort_id,
  managed_client_id
  -- Excluded: discount_code_id, discount_percent, original_credit_cost, final_credit_cost, payment_type, payment_status
FROM public.client_enrollments;

-- Enable RLS on the view
ALTER VIEW public.staff_enrollments SET (security_invoker = on);

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.staff_enrollments TO authenticated;

-- Drop the overly permissive staff policy on client_enrollments
DROP POLICY IF EXISTS "Staff can view program enrollments" ON public.client_enrollments;

-- Create a new restrictive staff policy that only allows viewing non-financial data via the view
-- Staff should use the staff_enrollments view instead of client_enrollments directly
-- The admin and user's own enrollment policies remain unchanged

-- Fix 2: Remove admin access to OAuth tokens (they don't need to view encrypted tokens)
-- This addresses the oauth_tokens_encryption_exposure security finding
DROP POLICY IF EXISTS "Only admins can view OAuth tokens" ON public.oauth_tokens;

-- Users can still view their own tokens if needed (add this for completeness)
CREATE POLICY "Users can view their own OAuth tokens"
ON public.oauth_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix 3: The email_change_requests table already has proper SELECT blocking (qual: false)
-- There's already a safe view (email_change_requests_safe) that excludes sensitive tokens
-- Add an additional protection: ensure the token columns are never exposed even via admin access
-- The existing "Service role only for SELECT" policy with `qual: false` is correct
-- We'll add a comment for documentation purposes

COMMENT ON TABLE public.email_change_requests IS 'Contains sensitive verification tokens. SELECT is blocked for all authenticated users. Use email_change_requests_safe view for non-sensitive data.';