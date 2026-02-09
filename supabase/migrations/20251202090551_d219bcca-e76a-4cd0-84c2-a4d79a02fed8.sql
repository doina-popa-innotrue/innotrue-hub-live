-- Relax username format constraint to allow email-style usernames
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_format
CHECK (
  username IS NULL
  OR username ~ '^[a-zA-Z0-9_]{3,30}$'::text
  OR username ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text
);
