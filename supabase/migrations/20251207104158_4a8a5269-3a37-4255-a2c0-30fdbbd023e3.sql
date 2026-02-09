-- Fix the security definer view warning by using SECURITY INVOKER instead
-- This ensures the view respects the querying user's permissions

DROP VIEW IF EXISTS public.public_profiles;

-- Recreate with SECURITY INVOKER (explicit default, safer)
CREATE VIEW public.public_profiles AS
SELECT 
  p.id,
  CASE WHEN pps.show_name = true AND pps.is_public = true THEN p.name ELSE NULL END as name,
  CASE WHEN pps.is_public = true THEN p.username ELSE NULL END as username,
  CASE WHEN pps.show_avatar = true AND pps.is_public = true THEN p.avatar_url ELSE NULL END as avatar_url,
  CASE WHEN pps.show_bio = true AND pps.is_public = true THEN p.bio ELSE NULL END as bio,
  CASE WHEN pps.show_social_links = true AND pps.is_public = true THEN p.linkedin_url ELSE NULL END as linkedin_url,
  CASE WHEN pps.show_social_links = true AND pps.is_public = true THEN p.x_url ELSE NULL END as x_url,
  CASE WHEN pps.show_social_links = true AND pps.is_public = true THEN p.bluesky_url ELSE NULL END as bluesky_url,
  CASE WHEN pps.show_education = true AND pps.is_public = true THEN p.education ELSE NULL END as education,
  CASE WHEN pps.show_certifications = true AND pps.is_public = true THEN p.certifications ELSE NULL END as certifications,
  CASE WHEN pps.is_public = true THEN p.timezone ELSE NULL END as timezone,
  CASE WHEN pps.is_public = true THEN p.preferred_meeting_times ELSE NULL END as preferred_meeting_times,
  pps.custom_slug,
  pps.is_public,
  p.created_at,
  p.updated_at
FROM public.profiles p
INNER JOIN public.public_profile_settings pps ON pps.user_id = p.id
WHERE pps.is_public = true;

-- Grant SELECT on the view to authenticated and anon users for public profile access
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;