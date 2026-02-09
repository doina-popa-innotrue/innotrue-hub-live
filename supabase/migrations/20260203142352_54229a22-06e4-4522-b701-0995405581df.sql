-- Create notification function for resource assignments
CREATE OR REPLACE FUNCTION public.notify_resource_assigned()
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
  v_resource_title TEXT;
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

  -- Get resource title
  SELECT r.title
  INTO v_resource_title
  FROM resource_library r
  WHERE r.id = NEW.resource_id;

  -- Get the notification type for 'content_updated' or use a fallback
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
      'New Resource Available',
      format('A new resource "%s" has been added to %s', COALESCE(v_resource_title, 'Resource'), COALESCE(v_module_title, 'your module')),
      format('/programs/%s/modules/%s', v_program_id, v_module_id),
      jsonb_build_object(
        'module_id', v_module_id,
        'module_title', v_module_title,
        'program_id', v_program_id,
        'program_name', v_program_name,
        'resource_id', NEW.resource_id,
        'resource_title', v_resource_title
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_resource_assigned ON module_client_content_resources;
CREATE TRIGGER trigger_notify_resource_assigned
  AFTER INSERT ON module_client_content_resources
  FOR EACH ROW
  EXECUTE FUNCTION notify_resource_assigned();

-- Also add a notification type for content updates if it doesn't exist
INSERT INTO notification_types (
  key,
  name,
  description,
  icon,
  category_id,
  default_in_app_enabled,
  default_email_enabled,
  order_index
)
SELECT 
  'content_updated',
  'Content Updated',
  'When new resources or content are added to your modules',
  'file-plus',
  (SELECT id FROM notification_categories WHERE key = 'learning' LIMIT 1),
  true,
  false,
  5
WHERE NOT EXISTS (
  SELECT 1 FROM notification_types WHERE key = 'content_updated'
);