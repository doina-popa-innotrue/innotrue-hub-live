-- Add Calendly event URL to groups table
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS calendly_event_url text;

-- Create group_sessions table to track booked sessions
CREATE TABLE public.group_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  session_date timestamp with time zone NOT NULL,
  duration_minutes integer DEFAULT 60,
  location text, -- Could be zoom link, meeting room, etc.
  calendly_event_uri text, -- Calendly's event URI for tracking
  calendly_invitee_uri text, -- Calendly's invitee URI
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  booked_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_group_sessions_group_id ON public.group_sessions(group_id);
CREATE INDEX idx_group_sessions_session_date ON public.group_sessions(session_date);

-- Enable RLS
ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_sessions
CREATE POLICY "Admins can manage all sessions" ON public.group_sessions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Group members can view sessions" ON public.group_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_memberships.group_id = group_sessions.group_id
      AND group_memberships.user_id = auth.uid()
      AND group_memberships.status = 'active'
    )
  );

CREATE POLICY "Group leaders can manage sessions" ON public.group_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_memberships.group_id = group_sessions.group_id
      AND group_memberships.user_id = auth.uid()
      AND group_memberships.role = 'leader'
      AND group_memberships.status = 'active'
    )
  );

-- Update trigger for updated_at
CREATE TRIGGER update_group_sessions_updated_at
  BEFORE UPDATE ON public.group_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();