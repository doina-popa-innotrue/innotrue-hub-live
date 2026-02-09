-- Create a junction table for session participants
CREATE TABLE public.module_session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.module_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  enrollment_id UUID REFERENCES public.client_enrollments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.module_session_participants ENABLE ROW LEVEL SECURITY;

-- Admins can manage all participants
CREATE POLICY "Admins can manage all session participants"
  ON public.module_session_participants
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructors/coaches can manage participants for their modules
CREATE POLICY "Instructors can manage participants for their modules"
  ON public.module_session_participants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM module_sessions ms
      WHERE ms.id = module_session_participants.session_id
      AND (
        EXISTS (SELECT 1 FROM module_instructors mi WHERE mi.module_id = ms.module_id AND mi.instructor_id = auth.uid())
        OR EXISTS (SELECT 1 FROM module_coaches mc WHERE mc.module_id = ms.module_id AND mc.coach_id = auth.uid())
      )
    )
  );

-- Users can view sessions they're participants in
CREATE POLICY "Users can view their session participations"
  ON public.module_session_participants
  FOR SELECT
  USING (auth.uid() = user_id);

-- Update the RLS policy for group sessions - clients can only see group sessions they're invited to
DROP POLICY IF EXISTS "Clients can view group sessions for their programs" ON public.module_sessions;

CREATE POLICY "Clients can view group sessions they are invited to"
  ON public.module_sessions
  FOR SELECT
  USING (
    session_type = 'group' AND EXISTS (
      SELECT 1 FROM module_session_participants msp
      WHERE msp.session_id = module_sessions.id
      AND msp.user_id = auth.uid()
    )
  );