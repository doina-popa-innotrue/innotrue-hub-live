-- Drop and recreate view with SECURITY INVOKER (default, safer)
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  username,
  avatar_url,
  bio,
  linkedin_url,
  x_url,
  bluesky_url,
  timezone,
  preferred_meeting_times,
  billing_city,
  billing_country,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;