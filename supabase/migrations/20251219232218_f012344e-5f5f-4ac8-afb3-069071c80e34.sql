-- Add content field to program_modules for rich text content
ALTER TABLE public.program_modules
ADD COLUMN content text;