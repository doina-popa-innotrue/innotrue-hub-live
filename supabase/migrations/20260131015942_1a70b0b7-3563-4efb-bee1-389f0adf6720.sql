-- Create group_session_participants table with accept/decline status
CREATE TABLE public.group_session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  response_status TEXT NOT NULL DEFAULT 'pending' CHECK (response_status IN ('pending', 'accepted', 'declined')),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.group_session_participants ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_group_session_participants_session ON public.group_session_participants(session_id);
CREATE INDEX idx_group_session_participants_user ON public.group_session_participants(user_id);
CREATE INDEX idx_group_session_participants_status ON public.group_session_participants(session_id, response_status);

-- RLS Policies

-- Users can view participants for sessions they're part of (or admins/instructors/coaches)
CREATE POLICY "Users can view group session participants"
ON public.group_session_participants FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.group_session_participants gsp 
    WHERE gsp.session_id = group_session_participants.session_id 
    AND gsp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'instructor', 'coach')
  )
);

-- Users can update their own participation status
CREATE POLICY "Users can update own participation"
ON public.group_session_participants FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins/instructors/coaches can insert participants
CREATE POLICY "Staff can insert participants"
ON public.group_session_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'instructor', 'coach')
  )
  OR auth.uid() = user_id
);

-- Admins can delete participants
CREATE POLICY "Admins can delete participants"
ON public.group_session_participants FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_group_session_participants_updated_at
BEFORE UPDATE ON public.group_session_participants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();