-- Add desired_target_role field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS desired_target_role text;

-- Add show_target_role visibility toggle to public_profile_settings
ALTER TABLE public.public_profile_settings 
ADD COLUMN IF NOT EXISTS show_target_role boolean NOT NULL DEFAULT false;