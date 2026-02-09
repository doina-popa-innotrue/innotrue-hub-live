-- Create enum for learning mode
CREATE TYPE public.learning_mode AS ENUM (
  'group_independent',
  'group_supervised', 
  'individual',
  'asynchronous'
);

-- Add new columns to program_modules
ALTER TABLE public.program_modules
ADD COLUMN learning_mode public.learning_mode DEFAULT 'asynchronous',
ADD COLUMN domain text,
ADD COLUMN capability_tags text[] DEFAULT '{}'::text[];

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_program_modules_learning_mode ON public.program_modules(learning_mode);
CREATE INDEX IF NOT EXISTS idx_program_modules_domain ON public.program_modules(domain);
CREATE INDEX IF NOT EXISTS idx_program_modules_capability_tags ON public.program_modules USING GIN(capability_tags);