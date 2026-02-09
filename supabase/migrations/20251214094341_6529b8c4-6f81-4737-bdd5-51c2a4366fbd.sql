-- Add logo_url column to programs table
ALTER TABLE public.programs 
ADD COLUMN logo_url text;