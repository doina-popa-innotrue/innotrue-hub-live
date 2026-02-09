-- Add real_email field to profiles for tracking pre-configured users
ALTER TABLE public.profiles ADD COLUMN real_email TEXT;

-- Add comment explaining purpose
COMMENT ON COLUMN public.profiles.real_email IS 'Used by admins to track the intended email for placeholder/pre-configured users';

-- Create index for lookup
CREATE INDEX idx_profiles_real_email ON public.profiles(real_email) WHERE real_email IS NOT NULL;