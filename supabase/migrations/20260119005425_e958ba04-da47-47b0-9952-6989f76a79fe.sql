-- Fix the admin authorization check in admin_bulk_delete_notifications
-- Replace the incorrect profiles.role check with the proper has_role function

CREATE OR REPLACE FUNCTION public.admin_bulk_delete_notifications(notification_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Use the correct has_role function for authorization
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can perform bulk delete';
  END IF;

  DELETE FROM public.notifications
  WHERE id = ANY(notification_ids);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;