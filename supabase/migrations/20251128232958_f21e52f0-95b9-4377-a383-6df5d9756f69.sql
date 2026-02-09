-- Add tier_required column to program_modules
ALTER TABLE public.program_modules 
ADD COLUMN tier_required text DEFAULT 'essentials' CHECK (tier_required IN ('essentials', 'premium'));

-- Add tier column to client_enrollments
ALTER TABLE public.client_enrollments 
ADD COLUMN tier text DEFAULT 'essentials' CHECK (tier IN ('essentials', 'premium'));

-- Add comment explaining the tiers
COMMENT ON COLUMN public.program_modules.tier_required IS 'The minimum subscription tier required to access this module';
COMMENT ON COLUMN public.client_enrollments.tier IS 'The subscription tier assigned to this enrollment (essentials or premium)';