-- Add unique constraint on custom_slug to prevent duplicates
ALTER TABLE public.public_profile_settings
ADD CONSTRAINT public_profile_settings_custom_slug_unique UNIQUE (custom_slug);