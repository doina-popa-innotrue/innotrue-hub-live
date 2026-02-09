-- Create notification function for scenario assignments
CREATE OR REPLACE FUNCTION public.notify_scenario_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_user_id UUID;
  v_module_id UUID;
  v_module_title TEXT;
  v_program_id UUID;
  v_program_name TEXT;
  v_notification_type_id UUID;
  v_scenario_title TEXT;
BEGIN
  -- Get the client user_id and module_id from module_client_content
  SELECT mcc.user_id, mcc.module_id
  INTO v_client_user_id, v_module_id
  FROM module_client_content mcc
  WHERE mcc.id = NEW.module_client_content_id;

  -- Get module and program info
  SELECT pm.title, pm.program_id
  INTO v_module_title, v_program_id
  FROM program_modules pm
  WHERE pm.id = v_module_id;

  SELECT p.name
  INTO v_program_name
  FROM programs p
  WHERE p.id = v_program_id;

  -- Get scenario title
  SELECT st.title
  INTO v_scenario_title
  FROM scenario_templates st
  WHERE st.id = NEW.scenario_template_id;

  -- Get the notification type for 'content_updated'
  SELECT id INTO v_notification_type_id
  FROM notification_types
  WHERE key = 'content_updated'
  LIMIT 1;

  -- If no specific type exists, use 'module_unlocked' as fallback
  IF v_notification_type_id IS NULL THEN
    SELECT id INTO v_notification_type_id
    FROM notification_types
    WHERE key = 'module_unlocked'
    LIMIT 1;
  END IF;

  -- Only create notification if we have the type and client
  IF v_notification_type_id IS NOT NULL AND v_client_user_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      notification_type_id,
      title,
      message,
      link,
      metadata
    ) VALUES (
      v_client_user_id,
      v_notification_type_id,
      'New Scenario Assigned',
      format('A new scenario "%s" has been assigned to %s', COALESCE(v_scenario_title, 'Scenario'), COALESCE(v_module_title, 'your module')),
      format('/programs/%s/modules/%s', v_program_id, v_module_id),
      jsonb_build_object(
        'module_id', v_module_id,
        'module_title', v_module_title,
        'program_id', v_program_id,
        'program_name', v_program_name,
        'scenario_template_id', NEW.scenario_template_id,
        'scenario_title', v_scenario_title
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_scenario_assigned ON module_client_content_scenarios;
CREATE TRIGGER trigger_notify_scenario_assigned
  AFTER INSERT ON module_client_content_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION notify_scenario_assigned();