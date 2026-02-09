-- Drop and recreate the view to add the calcom_booking_uid column
DROP VIEW IF EXISTS public.module_sessions_safe;

CREATE VIEW public.module_sessions_safe
WITH (security_invoker=on)
AS
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
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN ms.meeting_url
    WHEN can_manage_module_session(auth.uid(), ms.id) THEN ms.meeting_url
    -- Individual sessions: the enrollee can see the meeting link regardless of legacy client_response
    WHEN ms.session_type = 'individual'::text
      AND (ms.enrollment_id IN (
        SELECT ce.id
        FROM client_enrollments ce
        WHERE ce.client_user_id = auth.uid()
      )) THEN ms.meeting_url
    -- Group sessions: only accepted participants can see the meeting link
    WHEN ms.session_type = 'group'::text
      AND EXISTS (
        SELECT 1
        FROM module_session_participants msp
        WHERE msp.session_id = ms.id
          AND msp.user_id = auth.uid()
          AND msp.response_status = 'accepted'::text
      ) THEN ms.meeting_url
    ELSE NULL::text
  END AS meeting_url,
  -- Needed for Cal.com reschedule flow; same visibility rules as meeting_url
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN ms.calcom_booking_uid
    WHEN can_manage_module_session(auth.uid(), ms.id) THEN ms.calcom_booking_uid
    WHEN ms.session_type = 'individual'::text
      AND (ms.enrollment_id IN (
        SELECT ce.id
        FROM client_enrollments ce
        WHERE ce.client_user_id = auth.uid()
      )) THEN ms.calcom_booking_uid
    WHEN ms.session_type = 'group'::text
      AND EXISTS (
        SELECT 1
        FROM module_session_participants msp
        WHERE msp.session_id = ms.id
          AND msp.user_id = auth.uid()
          AND msp.response_status = 'accepted'::text
      ) THEN ms.calcom_booking_uid
    ELSE NULL::text
  END AS calcom_booking_uid,
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN ms.notes
    WHEN can_manage_module_session(auth.uid(), ms.id) THEN ms.notes
    ELSE NULL::text
  END AS notes
FROM public.module_sessions ms;

COMMENT ON VIEW public.module_sessions_safe IS 'Secure view of module_sessions. Shows meeting_url + calcom_booking_uid to staff and eligible participants; hides notes from non-staff.';

GRANT SELECT ON public.module_sessions_safe TO authenticated;