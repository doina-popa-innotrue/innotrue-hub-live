-- Add public_code column for external URL sharing
ALTER TABLE public.auth_contexts 
ADD COLUMN public_code TEXT UNIQUE;

-- Create function to generate random 8-character alphanumeric codes
CREATE OR REPLACE FUNCTION public.generate_public_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate public_code on insert
CREATE OR REPLACE FUNCTION public.set_auth_context_public_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_code IS NULL THEN
    NEW.public_code := public.generate_public_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auth_contexts_set_public_code
  BEFORE INSERT ON public.auth_contexts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_auth_context_public_code();

-- Backfill existing records with unique codes
UPDATE public.auth_contexts 
SET public_code = public.generate_public_code() 
WHERE public_code IS NULL;