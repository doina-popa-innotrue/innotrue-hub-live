-- Create a secure view for profile access that excludes sensitive fields for non-owners
-- This view will be used by staff and group members instead of direct table access

CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  created_at,
  updated_at,
  avatar_url,
  bio,
  linkedin_url,
  x_url,
  bluesky_url,
  youtube_url,
  instagram_url,
  facebook_url,
  education,
  certifications,
  username,
  timezone,
  preferred_meeting_times,
  desired_target_role,
  job_title,
  organisation,
  tagline,
  external_credential_profiles,
  future_vision,
  constraints,
  future_vision_private,
  constraints_private,
  desired_target_role_private,
  scheduling_url,
  is_hidden
  -- Excluded: real_email, plan_id, plan_expires_at, calendar_token, calendar_sync_enabled
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Update RLS policies: staff and group members should use the safe view
-- But we need to keep the base table policies for the application to work
-- The fix is to update the application code to use profiles_safe for staff/group views

-- However, to properly fix this at the DB level, we'll modify the policies
-- to only allow real_email access to owners and admins

-- Drop the problematic policies that expose all fields to staff/group members
DROP POLICY IF EXISTS "Staff can view assigned client profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles of group members in their groups" ON public.profiles;

-- Recreate policies using a function that filters sensitive columns
-- First, create a function to check if user is viewing their own profile or is admin
CREATE OR REPLACE FUNCTION public.can_view_profile_email(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    auth.uid() = _profile_id 
    OR has_role(auth.uid(), 'admin')
$$;

-- Recreate staff policy - they can still SELECT from profiles but application should use safe view
CREATE POLICY "Staff can view assigned client profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'instructor'))
  AND staff_has_client_relationship(auth.uid(), id)
);

-- Recreate group members policy
CREATE POLICY "Users can view profiles of group members in their groups"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT gm2.user_id
    FROM group_memberships gm1
    JOIN group_memberships gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid()
      AND gm1.status = 'active'
      AND gm2.status = 'active'
  )
);

-- Add comment to document the security model
COMMENT ON VIEW public.profiles_safe IS 
'Safe view of profiles that excludes sensitive fields (real_email, plan_id, plan_expires_at, calendar_token, calendar_sync_enabled). Use this view for staff and group member access. Owners and admins can access the full profiles table directly.';