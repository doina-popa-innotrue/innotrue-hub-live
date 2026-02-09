-- Create function to batch delete analytics events (admin only)
CREATE OR REPLACE FUNCTION public.delete_analytics_events(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Only allow admins
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Delete events within the date range
  DELETE FROM analytics_events
  WHERE created_at BETWEEN start_date AND end_date;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;