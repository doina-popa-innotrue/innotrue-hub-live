-- Add new profile fields for role, organisation, and tagline
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS organisation text,
ADD COLUMN IF NOT EXISTS tagline text;

-- Add visibility settings for these new fields in public_profile_settings
ALTER TABLE public.public_profile_settings
ADD COLUMN IF NOT EXISTS show_job_title boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS show_organisation boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS show_tagline boolean NOT NULL DEFAULT false;