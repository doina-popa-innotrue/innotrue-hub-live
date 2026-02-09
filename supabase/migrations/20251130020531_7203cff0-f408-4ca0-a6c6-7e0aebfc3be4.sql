-- Add scheduled_dates column to programs table
ALTER TABLE public.programs
ADD COLUMN scheduled_dates JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.programs.scheduled_dates IS 'Array of scheduled class dates with format: [{"id": "uuid", "date": "2024-01-15", "title": "Class 1"}]';

-- Update program_interest_registrations to store scheduled_date_id
ALTER TABLE public.program_interest_registrations
ADD COLUMN scheduled_date_id TEXT;