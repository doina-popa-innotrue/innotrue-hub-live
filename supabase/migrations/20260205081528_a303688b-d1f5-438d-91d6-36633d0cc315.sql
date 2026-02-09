-- Fix the notify_assignment_reviewed function to use program ID instead of slug
-- and include the module ID for direct navigation
CREATE OR REPLACE FUNCTION notify_assignment_reviewed()
RETURNS TRIGGER AS $$
DECLARE
  client_user_id uuid;
  assignment_type_name text;
  module_title text;
  program_id uuid;
  module_id uuid;
  notification_type_id uuid;
BEGIN
  -- Only trigger when status changes to 'reviewed'
  IF NEW.status = 'reviewed' AND (OLD.status IS NULL OR OLD.status != 'reviewed') THEN
    -- Get the client user_id through module_progress -> client_enrollments
    SELECT ce.client_user_id, mat.name, pm.title, p.id, pm.id
    INTO client_user_id, assignment_type_name, module_title, program_id, module_id
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
    
    -- Insert the notification with program ID and module ID for proper navigation
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
        '/programs/' || program_id || '/modules/' || module_id,
        jsonb_build_object(
          'assignment_id', NEW.id,
          'module_progress_id', NEW.module_progress_id,
          'assignment_type', assignment_type_name,
          'module_title', module_title,
          'scored_by', NEW.scored_by,
          'overall_score', NEW.overall_score,
          'program_id', program_id,
          'module_id', module_id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;