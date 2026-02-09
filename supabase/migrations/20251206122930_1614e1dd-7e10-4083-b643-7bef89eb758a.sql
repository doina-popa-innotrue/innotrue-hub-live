-- Create public_profile_settings table for managing public profile visibility
CREATE TABLE public.public_profile_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  custom_slug TEXT UNIQUE,
  show_name BOOLEAN NOT NULL DEFAULT true,
  show_avatar BOOLEAN NOT NULL DEFAULT true,
  show_bio BOOLEAN NOT NULL DEFAULT false,
  show_social_links BOOLEAN NOT NULL DEFAULT false,
  show_education BOOLEAN NOT NULL DEFAULT false,
  show_certifications BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create public_profile_interests table for selectable interests/values/drives
CREATE TABLE public.public_profile_interests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interest_type TEXT NOT NULL CHECK (interest_type IN ('interest', 'value', 'drive')),
  item_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, interest_type, item_value)
);

-- Add is_public column to goals table
ALTER TABLE public.goals ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Add is_public column to external_courses table
ALTER TABLE public.external_courses ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Add is_public column to client_enrollments table
ALTER TABLE public.client_enrollments ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.public_profile_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_profile_interests ENABLE ROW LEVEL SECURITY;

-- RLS for public_profile_settings
CREATE POLICY "Users can manage their own public profile settings"
ON public.public_profile_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view public profile settings for public profiles"
ON public.public_profile_settings
FOR SELECT
USING (is_public = true);

-- RLS for public_profile_interests
CREATE POLICY "Users can manage their own public interests"
ON public.public_profile_interests
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view public interests for public profiles"
ON public.public_profile_interests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public_profile_settings pps 
  WHERE pps.user_id = public_profile_interests.user_id 
  AND pps.is_public = true
));

-- Create index for slug lookups
CREATE INDEX idx_public_profile_settings_slug ON public.public_profile_settings(custom_slug) WHERE custom_slug IS NOT NULL;

-- Create function to validate slug format
CREATE OR REPLACE FUNCTION validate_profile_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.custom_slug IS NOT NULL THEN
    -- Slug must be lowercase, alphanumeric with hyphens, 3-50 chars
    IF NEW.custom_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' THEN
      RAISE EXCEPTION 'Invalid slug format. Use 3-50 lowercase letters, numbers, and hyphens.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_slug_before_insert_update
BEFORE INSERT OR UPDATE ON public.public_profile_settings
FOR EACH ROW EXECUTE FUNCTION validate_profile_slug();

-- Update timestamp trigger
CREATE TRIGGER update_public_profile_settings_updated_at
BEFORE UPDATE ON public.public_profile_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();