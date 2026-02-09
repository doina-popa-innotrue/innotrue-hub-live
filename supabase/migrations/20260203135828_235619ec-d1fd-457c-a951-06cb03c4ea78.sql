-- Function to notify client when their assignment is reviewed
CREATE OR REPLACE FUNCTION public.notify_assignment_reviewed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_user_id uuid;
  assignment_type_name text;
  module_title text;
  program_slug text;
  notification_type_id uuid;
BEGIN
  -- Only trigger when status changes to 'reviewed'
  IF NEW.status = 'reviewed' AND (OLD.status IS NULL OR OLD.status != 'reviewed') THEN
    -- Get the client user_id through module_progress -> client_enrollments
    SELECT ce.client_user_id, mat.name, pm.title, p.slug
    INTO client_user_id, assignment_type_name, module_title, program_slug
    FROM module_progress mp
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    JOIN program_modules pm ON pm.id = mp.module_id
    JOIN programs p ON p.id = pm.program_id
    JOIN module_assignment_types mat ON mat.id = NEW.assignment_type_id
    WHERE mp.id = NEW.module_progress_id;
    
    -- Get the notification type ID for 'assignment_graded'
    SELECT id INTO notification_type_id
    FROM notification_types
    WHERE key = 'assignment_graded';
    
    -- Insert the notification
    IF client_user_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        notification_type_id,
        title,
        message,
        link,
        metadata
      ) VALUES (
        client_user_id,
        notification_type_id,
        'Assignment Reviewed: ' || assignment_type_name,
        'Your assignment for "' || module_title || '" has been reviewed by an instructor.',
        '/programs/' || program_slug,
        jsonb_build_object(
          'assignment_id', NEW.id,
          'module_progress_id', NEW.module_progress_id,
          'assignment_type', assignment_type_name,
          'module_title', module_title,
          'scored_by', NEW.scored_by,
          'overall_score', NEW.overall_score
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for assignment reviews
DROP TRIGGER IF EXISTS trigger_notify_assignment_reviewed ON module_assignments;
CREATE TRIGGER trigger_notify_assignment_reviewed
  AFTER UPDATE ON module_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_assignment_reviewed();

-- Function to notify client when they are added to a session
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
  LEFT JOIN profiles prof ON prof.id = COALESCE(ms.instructor_id, ms.coach_id)
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

-- Create trigger for session participant notifications
DROP TRIGGER IF EXISTS trigger_notify_session_participant_added ON module_session_participants;
CREATE TRIGGER trigger_notify_session_participant_added
  AFTER INSERT ON module_session_participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_session_participant_added();