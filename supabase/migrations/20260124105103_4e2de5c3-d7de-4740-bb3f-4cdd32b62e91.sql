-- Add response_status column to track participant acceptance
ALTER TABLE public.module_session_participants 
ADD COLUMN response_status TEXT NOT NULL DEFAULT 'pending' CHECK (response_status IN ('pending', 'accepted', 'declined'));

-- Add index for faster lookups
CREATE INDEX idx_session_participants_response ON public.module_session_participants(session_id, response_status);

-- Create a secure view for module_sessions that hides sensitive data from non-confirmed participants
-- This view will be used by clients to access session data safely
CREATE OR REPLACE VIEW public.module_sessions_safe AS
SELECT 
  ms.id,
  ms.module_id,
  ms.enrollment_id,
  ms.title,
  ms.description,
  ms.session_date,
  ms.duration_minutes,
  ms.location,
  ms.status,
  ms.booked_by,
  ms.instructor_id,
  ms.created_at,
  ms.updated_at,
  ms.session_type,
  ms.program_id,
  ms.requested_by,
  ms.request_message,
  ms.client_response,
  ms.is_recurring,
  ms.recurrence_pattern,
  ms.recurrence_end_date,
  ms.recurrence_count,
  ms.parent_session_id,
  -- Only show meeting_url if:
  -- 1. User is admin/instructor/coach for this session, OR
  -- 2. For individual sessions: client_response = 'accepted', OR  
  -- 3. For group sessions: user has accepted in participants table
  CASE 
    WHEN has_role(auth.uid(), 'admin') THEN ms.meeting_url
    WHEN can_manage_module_session(auth.uid(), ms.id) THEN ms.meeting_url
    WHEN ms.session_type = 'individual' AND ms.client_response = 'accepted' AND 
         ms.enrollment_id IN (SELECT id FROM client_enrollments WHERE client_user_id = auth.uid()) THEN ms.meeting_url
    WHEN ms.session_type = 'group' AND EXISTS (
      SELECT 1 FROM module_session_participants msp 
      WHERE msp.session_id = ms.id 
      AND msp.user_id = auth.uid() 
      AND msp.response_status = 'accepted'
    ) THEN ms.meeting_url
    ELSE NULL
  END AS meeting_url,
  -- Only show notes to staff
  CASE 
    WHEN has_role(auth.uid(), 'admin') THEN ms.notes
    WHEN can_manage_module_session(auth.uid(), ms.id) THEN ms.notes
    ELSE NULL
  END AS notes
FROM public.module_sessions ms;

-- Use security invoker so the view respects RLS of underlying table
ALTER VIEW public.module_sessions_safe SET (security_invoker = on);

-- Grant access to authenticated users
GRANT SELECT ON public.module_sessions_safe TO authenticated;

-- Add policy to allow participants to update their own response_status
CREATE POLICY "Participants can update their response"
  ON public.module_session_participants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add comment for documentation
COMMENT ON VIEW public.module_sessions_safe IS 'Secure view of module_sessions that hides meeting_url from non-confirmed participants and notes from non-staff users';