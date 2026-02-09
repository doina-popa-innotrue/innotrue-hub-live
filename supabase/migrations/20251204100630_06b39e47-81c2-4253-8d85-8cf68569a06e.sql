-- Add timezone and preferred meeting times (visible to all users)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS preferred_meeting_times jsonb DEFAULT '[]'::jsonb;

-- Add billing information (private - admin only, except city/country)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS billing_company text,
ADD COLUMN IF NOT EXISTS billing_vat text,
ADD COLUMN IF NOT EXISTS billing_address_line1 text,
ADD COLUMN IF NOT EXISTS billing_address_line2 text,
ADD COLUMN IF NOT EXISTS billing_city text,
ADD COLUMN IF NOT EXISTS billing_country text,
ADD COLUMN IF NOT EXISTS billing_postal_code text;

-- Create a view for public profile data (excludes sensitive billing info)
CREATE OR REPLACE VIEW public.public_profiles AS
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

-- Create security definer function to check if user can view full billing info
CREATE OR REPLACE FUNCTION public.can_view_billing_info(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    auth.uid() = target_user_id 
    OR has_role(auth.uid(), 'admin'::app_role)
$$;