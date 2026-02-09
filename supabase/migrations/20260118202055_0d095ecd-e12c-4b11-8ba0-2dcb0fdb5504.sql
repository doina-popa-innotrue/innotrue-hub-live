-- Add system settings for notification cleanup
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('notification_retention_days', '90', 'Number of days to retain notifications before automatic cleanup'),
  ('notification_cleanup_frequency_hours', '24', 'How often (in hours) the notification cleanup job should run')
ON CONFLICT (key) DO NOTHING;

-- Create function for bulk deleting notifications by admin
CREATE OR REPLACE FUNCTION public.admin_bulk_delete_notifications(notification_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can perform bulk delete';
  END IF;

  DELETE FROM public.notifications
  WHERE id = ANY(notification_ids);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Create function for cleanup of old notifications
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_days integer;
  deleted_count integer;
BEGIN
  -- Get retention days from system settings
  SELECT COALESCE(value::integer, 90) INTO retention_days
  FROM public.system_settings
  WHERE key = 'notification_retention_days';

  -- Delete old notifications
  DELETE FROM public.notifications
  WHERE created_at < NOW() - (retention_days || ' days')::interval;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_bulk_delete_notifications(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO service_role;