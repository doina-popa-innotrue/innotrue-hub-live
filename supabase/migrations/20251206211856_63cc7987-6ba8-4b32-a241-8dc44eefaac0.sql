-- Recreate the view with SECURITY INVOKER to use the querying user's permissions
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
SELECT 
    p.id,
    CASE WHEN pps.show_name THEN p.name ELSE NULL END as name,
    p.username,
    CASE WHEN pps.show_avatar THEN p.avatar_url ELSE NULL END as avatar_url,
    CASE WHEN pps.show_bio THEN p.bio ELSE NULL END as bio,
    CASE WHEN pps.show_social_links THEN p.linkedin_url ELSE NULL END as linkedin_url,
    CASE WHEN pps.show_social_links THEN p.x_url ELSE NULL END as x_url,
    CASE WHEN pps.show_social_links THEN p.bluesky_url ELSE NULL END as bluesky_url,
    p.timezone,
    p.preferred_meeting_times,
    p.billing_city,
    p.billing_country,
    p.created_at,
    p.updated_at,
    pps.custom_slug,
    pps.show_education,
    pps.show_certifications
FROM public.profiles p
INNER JOIN public.public_profile_settings pps ON pps.user_id = p.id
WHERE pps.is_public = true;

COMMENT ON VIEW public.public_profiles IS 'Only shows profiles where users have opted to make their profile public (is_public=true). Individual fields are shown/hidden based on user visibility preferences. Uses SECURITY INVOKER to respect querying user permissions.';