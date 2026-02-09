-- Fix the validate_profile_slug function to set search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;