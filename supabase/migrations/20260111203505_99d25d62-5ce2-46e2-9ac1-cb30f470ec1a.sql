-- Add canonical_code to program_modules for cross-program linking
ALTER TABLE public.program_modules 
ADD COLUMN IF NOT EXISTS canonical_code TEXT;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_program_modules_canonical_code 
ON public.program_modules(canonical_code) 
WHERE canonical_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.program_modules.canonical_code IS 'Optional code to link equivalent modules across programs. Modules with the same canonical_code are considered the same content for cross-program completion tracking.';