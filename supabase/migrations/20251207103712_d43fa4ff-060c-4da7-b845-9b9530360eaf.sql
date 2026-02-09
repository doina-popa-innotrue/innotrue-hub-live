-- 1. Fix public_profiles view exposure - recreate with security barrier and proper is_public checks
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE VIEW public.public_profiles WITH (security_barrier = true) AS
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
LEFT JOIN public.public_profile_settings pps ON pps.user_id = p.id
WHERE pps.is_public = true;

-- Remove billing fields from the view (they should not be exposed publicly at all)
-- Billing city and country are now only in billing_info table

-- 2. Remove billing columns from profiles table (data should be in billing_info table only)
-- First migrate any existing billing data to billing_info table
INSERT INTO public.billing_info (user_id, company, vat, address_line1, address_line2, city, country, postal_code)
SELECT 
  p.id,
  p.billing_company,
  p.billing_vat,
  p.billing_address_line1,
  p.billing_address_line2,
  p.billing_city,
  p.billing_country,
  p.billing_postal_code
FROM public.profiles p
WHERE (p.billing_company IS NOT NULL OR p.billing_vat IS NOT NULL OR 
       p.billing_address_line1 IS NOT NULL OR p.billing_city IS NOT NULL OR 
       p.billing_country IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.billing_info bi WHERE bi.user_id = p.id);

-- Now drop the billing columns from profiles
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS billing_company,
  DROP COLUMN IF EXISTS billing_vat,
  DROP COLUMN IF EXISTS billing_address_line1,
  DROP COLUMN IF EXISTS billing_address_line2,
  DROP COLUMN IF EXISTS billing_city,
  DROP COLUMN IF EXISTS billing_postal_code,
  DROP COLUMN IF EXISTS billing_country;

-- 3. Add encrypted storage for oauth tokens
ALTER TABLE public.oauth_tokens 
  ADD COLUMN IF NOT EXISTS access_token_encrypted bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted bytea,
  ADD COLUMN IF NOT EXISTS encryption_key_id text;

-- Add comment explaining the encryption requirement
COMMENT ON COLUMN public.oauth_tokens.access_token_encrypted IS 'Encrypted access token - use application-level encryption before storing';
COMMENT ON COLUMN public.oauth_tokens.refresh_token_encrypted IS 'Encrypted refresh token - use application-level encryption before storing';

-- Make plaintext token columns nullable for transition period
-- Eventually these should be dropped after migration to encrypted storage
ALTER TABLE public.oauth_tokens 
  ALTER COLUMN access_token DROP NOT NULL;

-- Update RLS on oauth_tokens to be more restrictive
DROP POLICY IF EXISTS "Users can manage own tokens" ON public.oauth_tokens;
DROP POLICY IF EXISTS "Users can only access their own tokens" ON public.oauth_tokens;

CREATE POLICY "Users can only access their own tokens"
ON public.oauth_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);