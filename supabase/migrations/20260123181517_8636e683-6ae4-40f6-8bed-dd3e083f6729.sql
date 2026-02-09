-- Fix search_path for generate_public_code function
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix search_path for set_auth_context_public_code function
CREATE OR REPLACE FUNCTION public.set_auth_context_public_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_code IS NULL THEN
    NEW.public_code := public.generate_public_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;