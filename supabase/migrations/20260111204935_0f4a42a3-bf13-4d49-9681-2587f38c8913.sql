-- Add columns for tracking cross-program completions and discount suggestions
ALTER TABLE public.program_interest_registrations 
ADD COLUMN IF NOT EXISTS completed_modules_elsewhere JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS suggested_discount_percent INTEGER DEFAULT 0;

-- Add a comment explaining the columns
COMMENT ON COLUMN public.program_interest_registrations.completed_modules_elsewhere IS 'JSON array of modules the user has already completed in other programs';
COMMENT ON COLUMN public.program_interest_registrations.suggested_discount_percent IS 'Suggested discount percentage based on prior completions';