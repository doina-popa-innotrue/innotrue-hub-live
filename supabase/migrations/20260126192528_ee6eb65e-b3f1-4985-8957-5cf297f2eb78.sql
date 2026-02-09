-- Update the handle_new_user function to also set username to the user's email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$;

-- Backfill existing profiles that have null username
UPDATE public.profiles p
SET username = u.email
FROM auth.users u
WHERE p.id = u.id AND p.username IS NULL;