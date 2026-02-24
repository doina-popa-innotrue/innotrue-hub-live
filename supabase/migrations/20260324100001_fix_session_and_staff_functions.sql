-- Schema Drift Fix Sprint 1B: Fix DB triggers with non-existent column references

-- Fix 1: notify_session_participant_added() references ms.coach_id which doesn't exist
-- on module_sessions. Only ms.instructor_id exists. The COALESCE silently returns null
-- for the coach fallback, which is harmless when instructor_id has a value but incorrect.
CREATE OR REPLACE FUNCTION public.notify_session_participant_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_date timestamptz;
  module_title text;
  program_slug text;
  notification_type_id uuid;
  instructor_name text;
BEGIN
  -- Get session details
  SELECT ms.session_date, pm.title, p.slug, prof.name
  INTO session_date, module_title, program_slug, instructor_name
  FROM module_sessions ms
  JOIN program_modules pm ON pm.id = ms.module_id
  JOIN programs p ON p.id = pm.program_id
  LEFT JOIN profiles prof ON prof.id = ms.instructor_id
  WHERE ms.id = NEW.session_id;

  -- Get the notification type ID for 'session_scheduled'
  SELECT id INTO notification_type_id
  FROM notification_types
  WHERE key = 'session_scheduled';

  -- Insert the notification for the participant
  IF NEW.user_id IS NOT NULL AND session_date IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      notification_type_id,
      title,
      message,
      link,
      metadata
    ) VALUES (
      NEW.user_id,
      notification_type_id,
      'Session Scheduled: ' || module_title,
      'A session has been scheduled for ' || to_char(session_date AT TIME ZONE 'UTC', 'Mon DD, YYYY at HH12:MI AM') || ' UTC' ||
        CASE WHEN instructor_name IS NOT NULL THEN ' with ' || instructor_name ELSE '' END || '.',
      '/programs/' || program_slug,
      jsonb_build_object(
        'session_id', NEW.session_id,
        'session_date', session_date,
        'module_title', module_title,
        'instructor_name', instructor_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Fix 2: staff_has_client_relationship() missing enrollment_module_staff check.
-- This function is used in RLS policies for client_staff_notes.
-- It checks program-level, module-level, and direct client assignments,
-- but NOT enrollment-level staff assignments (enrollment_module_staff).
CREATE OR REPLACE FUNCTION public.staff_has_client_relationship(_staff_id uuid, _client_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- 1. Direct coach assignment to client
    EXISTS (
      SELECT 1 FROM client_coaches
      WHERE coach_id = _staff_id AND client_id = _client_user_id
    )
    OR
    -- 2. Program instructor for any of client's enrolled programs
    EXISTS (
      SELECT 1 FROM program_instructors pi
      JOIN client_enrollments ce ON ce.program_id = pi.program_id
      WHERE pi.instructor_id = _staff_id
        AND ce.client_user_id = _client_user_id
    )
    OR
    -- 3. Program coach for any of client's enrolled programs
    EXISTS (
      SELECT 1 FROM program_coaches pc
      JOIN client_enrollments ce ON ce.program_id = pc.program_id
      WHERE pc.coach_id = _staff_id
        AND ce.client_user_id = _client_user_id
    )
    OR
    -- 4. Module instructor for any module in client's enrolled programs
    EXISTS (
      SELECT 1 FROM module_instructors mi
      JOIN program_modules pm ON pm.id = mi.module_id
      JOIN client_enrollments ce ON ce.program_id = pm.program_id
      WHERE mi.instructor_id = _staff_id
        AND ce.client_user_id = _client_user_id
    )
    OR
    -- 5. Module coach for any module in client's enrolled programs
    EXISTS (
      SELECT 1 FROM module_coaches mc
      JOIN program_modules pm ON pm.id = mc.module_id
      JOIN client_enrollments ce ON ce.program_id = pm.program_id
      WHERE mc.coach_id = _staff_id
        AND ce.client_user_id = _client_user_id
    )
    OR
    -- 6. Enrollment-level staff assignment (per-client per-module)
    EXISTS (
      SELECT 1 FROM enrollment_module_staff ems
      JOIN client_enrollments ce ON ce.id = ems.enrollment_id
      WHERE ems.staff_user_id = _staff_id
        AND ce.client_user_id = _client_user_id
    )
$$;
