-- Add signup_enabled system setting and public RPC for unauthenticated access.
-- When "false", the signup form, "Create Account" links, and the signup-user
-- edge function are blocked. Existing users can still log in. New Google OAuth
-- users will be blocked at /complete-registration.

-- 1. Insert the setting row (default: enabled)
INSERT INTO system_settings (key, value, description)
VALUES (
  'signup_enabled',
  'true',
  'When "false", public self-registration is disabled. Signup form and edge function are blocked. Existing users can still log in. New Google OAuth users are blocked at registration.'
)
ON CONFLICT (key) DO NOTHING;

-- 2. Create a public RPC that anonymous users can call from the Auth page.
--    Uses SECURITY DEFINER to bypass RLS on system_settings.
--    Returns only a boolean — zero information leakage.
CREATE OR REPLACE FUNCTION public.get_signup_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value = 'true' FROM system_settings WHERE key = 'signup_enabled'),
    true  -- default to enabled if row is missing
  );
$$;

-- Grant to anon (Auth page) and authenticated (CompleteRegistration page)
GRANT EXECUTE ON FUNCTION public.get_signup_enabled() TO anon, authenticated;
