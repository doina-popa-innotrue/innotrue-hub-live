-- Add username field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN username text;

-- Add unique constraint on username
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Add check constraint for username format (alphanumeric and underscores only, 3-30 characters)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_username_format CHECK (
  username IS NULL OR (
    username ~ '^[a-zA-Z0-9_]{3,30}$'
  )
);

-- Create index for faster username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Add comment explaining the username rules
COMMENT ON COLUMN public.profiles.username IS 'Unique username, alphanumeric and underscores only, 3-30 characters';