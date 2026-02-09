-- Add display_name column to plans table for customizable UI labels
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS display_name text DEFAULT 'plan';

-- Add display_name column to tracks table
ALTER TABLE public.tracks 
ADD COLUMN IF NOT EXISTS display_name text DEFAULT 'learning track';

-- Add display_name column to add_ons table
ALTER TABLE public.add_ons 
ADD COLUMN IF NOT EXISTS display_name text DEFAULT 'add-on';

-- Add display_name column to program_plans table
ALTER TABLE public.program_plans 
ADD COLUMN IF NOT EXISTS display_name text DEFAULT 'program';

-- Add comments for documentation
COMMENT ON COLUMN public.plans.display_name IS 'Customizable label for UI display (e.g., "subscription plan", "membership tier")';
COMMENT ON COLUMN public.tracks.display_name IS 'Customizable label for UI display (e.g., "learning track", "pathway")';
COMMENT ON COLUMN public.add_ons.display_name IS 'Customizable label for UI display (e.g., "add-on", "enhancement")';
COMMENT ON COLUMN public.program_plans.display_name IS 'Customizable label for UI display (e.g., "program", "course tier")';