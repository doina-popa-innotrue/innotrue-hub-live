-- Remove check constraints on tier fields to allow flexible tier names
ALTER TABLE public.client_enrollments DROP CONSTRAINT IF EXISTS client_enrollments_tier_check;
ALTER TABLE public.program_modules DROP CONSTRAINT IF EXISTS program_modules_tier_required_check;

-- Add tiers field to programs table to store available tier names
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS tiers jsonb DEFAULT '["Essentials", "Premium"]'::jsonb;

-- Update existing programs to have default tiers
UPDATE public.programs SET tiers = '["Essentials", "Premium"]'::jsonb WHERE tiers IS NULL;