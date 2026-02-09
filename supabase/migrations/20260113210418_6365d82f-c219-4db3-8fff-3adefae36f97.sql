-- Add recurrence columns to module_sessions
ALTER TABLE public.module_sessions
ADD COLUMN is_recurring boolean NOT NULL DEFAULT false,
ADD COLUMN recurrence_pattern text NULL,
ADD COLUMN recurrence_end_date date NULL,
ADD COLUMN recurrence_count integer NULL,
ADD COLUMN parent_session_id uuid NULL REFERENCES public.module_sessions(id) ON DELETE CASCADE;

-- Create index for parent session lookups
CREATE INDEX idx_module_sessions_parent ON public.module_sessions(parent_session_id) WHERE parent_session_id IS NOT NULL;

-- Add comment for recurrence pattern values
COMMENT ON COLUMN public.module_sessions.recurrence_pattern IS 'Values: daily, weekly, bi-weekly, monthly';

-- Insert system setting for max recurrence occurrences
INSERT INTO public.system_settings (key, value, description)
VALUES ('max_recurrence_occurrences', '20', 'Maximum number of recurring session instances that can be generated (1-50)')
ON CONFLICT (key) DO NOTHING;