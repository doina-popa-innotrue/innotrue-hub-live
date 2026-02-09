-- Add is_hidden flag to profiles for placeholder visibility control
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_hidden IS 'When true, this placeholder profile is hidden from auto-transfer during signup verification. Admin can manually transfer data later.';