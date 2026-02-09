-- Add external_credential_profiles column to profiles table for Trailhead, Credly, etc.
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS external_credential_profiles jsonb DEFAULT '[]'::jsonb;