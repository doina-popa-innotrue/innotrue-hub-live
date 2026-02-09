-- Add canonical code field to programs table
ALTER TABLE public.programs 
ADD COLUMN code text UNIQUE;

-- Add canonical code field to program_modules table
ALTER TABLE public.program_modules 
ADD COLUMN code text;

-- Create unique index for module codes within a program (codes must be unique per program, not globally)
CREATE UNIQUE INDEX idx_program_modules_code_per_program 
ON public.program_modules (program_id, code) 
WHERE code IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.programs.code IS 'Canonical code for external system integration (e.g., TalentLMS, Articulate Rise)';
COMMENT ON COLUMN public.program_modules.code IS 'Canonical code for external system integration (e.g., TalentLMS course ID)';