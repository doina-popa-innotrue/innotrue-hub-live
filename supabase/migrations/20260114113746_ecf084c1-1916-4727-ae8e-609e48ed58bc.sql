-- Add parent_session_id column to group_sessions for recurring session series tracking
ALTER TABLE public.group_sessions 
ADD COLUMN parent_session_id UUID REFERENCES public.group_sessions(id) ON DELETE SET NULL;

-- Create index for efficient querying of session series
CREATE INDEX idx_group_sessions_parent_session_id ON public.group_sessions(parent_session_id);