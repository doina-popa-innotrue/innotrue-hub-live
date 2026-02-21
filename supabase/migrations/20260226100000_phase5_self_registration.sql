-- Phase 5: Self-Registration & Scale
-- Adds registration tracking to profiles, context tracking to signup flow,
-- and role application fields to coach_instructor_requests.
-- DEFAULT 'complete' ensures all existing profiles are unaffected.

-- 1. profiles: registration status tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'complete';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.registration_status IS 'Registration flow state: pending_role_selection, pending_approval, complete, declined';
COMMENT ON COLUMN public.profiles.verification_status IS 'Staff verification: null (unverified), verified';
COMMENT ON COLUMN public.profiles.verified_at IS 'When admin verified the user as coach/instructor';

-- 2. signup_verification_requests: context tracking for signup flow
ALTER TABLE public.signup_verification_requests
  ADD COLUMN IF NOT EXISTS plan_interest TEXT;

ALTER TABLE public.signup_verification_requests
  ADD COLUMN IF NOT EXISTS context_data JSONB;

COMMENT ON COLUMN public.signup_verification_requests.plan_interest IS 'Plan selected during signup (from pricing page or wheel assessment)';
COMMENT ON COLUMN public.signup_verification_requests.context_data IS 'Signup context: auto_enroll_program, utm params, context_slug, etc.';

-- 3. coach_instructor_requests: role application fields
-- (admin_notes column already exists from original migration)
ALTER TABLE public.coach_instructor_requests
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'client_request';

ALTER TABLE public.coach_instructor_requests
  ADD COLUMN IF NOT EXISTS specialties TEXT;

ALTER TABLE public.coach_instructor_requests
  ADD COLUMN IF NOT EXISTS certifications TEXT;

ALTER TABLE public.coach_instructor_requests
  ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE public.coach_instructor_requests
  ADD COLUMN IF NOT EXISTS scheduling_url TEXT;

COMMENT ON COLUMN public.coach_instructor_requests.source_type IS 'client_request = client wants A coach assigned; role_application = user wants to BE a coach/instructor';
COMMENT ON COLUMN public.coach_instructor_requests.specialties IS 'Comma-separated specialties (role applications)';
COMMENT ON COLUMN public.coach_instructor_requests.certifications IS 'Comma-separated certifications (role applications)';
COMMENT ON COLUMN public.coach_instructor_requests.bio IS 'Professional bio (role applications)';
COMMENT ON COLUMN public.coach_instructor_requests.scheduling_url IS 'Cal.com or other scheduling URL (role applications)';

-- Note: RLS policies for coach_instructor_requests already exist from migration 20260115161516:
--   "Users can view their own requests" (SELECT, user_id = auth.uid())
--   "Users can create their own requests" (INSERT, user_id = auth.uid())
--   "Admins can manage all requests" (ALL, has_role(admin))
-- These are sufficient for Phase 5 — role applications use the same table with source_type differentiation.
