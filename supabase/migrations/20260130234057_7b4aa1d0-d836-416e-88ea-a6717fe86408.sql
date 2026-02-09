-- Add module_type and scheduling_url to calcom_event_type_mappings
-- This enables mapping by module type and storing the Cal.com booking URL

ALTER TABLE public.calcom_event_type_mappings 
ADD COLUMN IF NOT EXISTS module_type TEXT REFERENCES module_types(name) ON UPDATE CASCADE,
ADD COLUMN IF NOT EXISTS scheduling_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.calcom_event_type_mappings.module_type IS 'Maps Cal.com event type to a specific module type (e.g., coaching, session)';
COMMENT ON COLUMN public.calcom_event_type_mappings.scheduling_url IS 'Cal.com booking URL for this event type';

-- Add columns to module_sessions and group_sessions for linking to enrollment
ALTER TABLE public.module_sessions 
ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES client_enrollments(id) ON DELETE SET NULL;

ALTER TABLE public.group_sessions 
ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES client_enrollments(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN public.module_sessions.enrollment_id IS 'Links session to specific client enrollment (populated from Cal.com booking metadata)';
COMMENT ON COLUMN public.group_sessions.enrollment_id IS 'Links session to enrollment of the booker (for Cal.com bookings)';