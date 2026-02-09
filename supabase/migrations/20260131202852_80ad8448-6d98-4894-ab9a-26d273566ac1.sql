-- Add booking_url to instructor_calcom_event_types
-- This allows storing the full Cal.com booking URL directly for child events
-- which cannot be fetched via the Cal.com API

ALTER TABLE public.instructor_calcom_event_types 
ADD COLUMN IF NOT EXISTS booking_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.instructor_calcom_event_types.booking_url IS 'Full Cal.com booking URL for this child event type. Use this when the Cal.com API cannot resolve the URL (e.g., for managed event child types).';