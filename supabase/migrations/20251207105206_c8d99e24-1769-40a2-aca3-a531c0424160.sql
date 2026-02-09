
-- Fix 1: Recreate public_profiles view with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  CASE WHEN pps.show_name = true AND pps.is_public = true THEN p.name ELSE NULL END AS name,
  CASE WHEN pps.is_public = true THEN p.username ELSE NULL END AS username,
  CASE WHEN pps.show_avatar = true AND pps.is_public = true THEN p.avatar_url ELSE NULL END AS avatar_url,
  CASE WHEN pps.show_bio = true AND pps.is_public = true THEN p.bio ELSE NULL END AS bio,
  CASE WHEN pps.show_social_links = true AND pps.is_public = true THEN p.linkedin_url ELSE NULL END AS linkedin_url,
  CASE WHEN pps.show_social_links = true AND pps.is_public = true THEN p.x_url ELSE NULL END AS x_url,
  CASE WHEN pps.show_social_links = true AND pps.is_public = true THEN p.bluesky_url ELSE NULL END AS bluesky_url,
  CASE WHEN pps.show_education = true AND pps.is_public = true THEN p.education ELSE NULL END AS education,
  CASE WHEN pps.show_certifications = true AND pps.is_public = true THEN p.certifications ELSE NULL END AS certifications,
  CASE WHEN pps.is_public = true THEN p.timezone ELSE NULL END AS timezone,
  CASE WHEN pps.is_public = true THEN p.preferred_meeting_times ELSE NULL END AS preferred_meeting_times,
  pps.custom_slug,
  pps.is_public,
  p.created_at,
  p.updated_at
FROM public.profiles p
JOIN public.public_profile_settings pps ON pps.user_id = p.id
WHERE pps.is_public = true;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Fix 2: Move pg_net extension to extensions schema
-- First ensure extensions schema exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop and recreate pg_net in extensions schema
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
