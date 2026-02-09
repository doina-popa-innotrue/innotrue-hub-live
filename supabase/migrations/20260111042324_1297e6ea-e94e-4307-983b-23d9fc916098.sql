-- Allow anyone to view profiles that have public profile settings enabled
CREATE POLICY "Anyone can view profiles with public profile settings"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public_profile_settings pps
    WHERE pps.user_id = profiles.id
    AND pps.is_public = true
  )
);