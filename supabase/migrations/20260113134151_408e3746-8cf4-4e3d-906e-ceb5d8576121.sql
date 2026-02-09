-- Allow clients to update client_response on their own sessions
CREATE POLICY "Clients can respond to their sessions"
ON public.module_sessions
FOR UPDATE
USING (
  enrollment_id IN (
    SELECT id FROM client_enrollments WHERE client_user_id = auth.uid()
  )
  OR id IN (
    SELECT session_id FROM module_session_participants WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  enrollment_id IN (
    SELECT id FROM client_enrollments WHERE client_user_id = auth.uid()
  )
  OR id IN (
    SELECT session_id FROM module_session_participants WHERE user_id = auth.uid()
  )
);