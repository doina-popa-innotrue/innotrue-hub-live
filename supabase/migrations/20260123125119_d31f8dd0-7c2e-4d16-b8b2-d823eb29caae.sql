-- Add is_active column to features table for controlling feature visibility
ALTER TABLE public.features
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.features.is_active IS 'When false, feature is hidden globally (except for admins). Use for stealth development or deprecation.';