-- Create function to delete old webhook logs
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_logs(retention_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.calcom_webhook_logs
  WHERE created_at < NOW() - (retention_days || ' days')::interval;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute to authenticated users (admin check happens in app)
GRANT EXECUTE ON FUNCTION public.cleanup_old_webhook_logs(integer) TO authenticated;

-- Create daily cron job to cleanup logs older than 30 days
SELECT cron.schedule(
  'cleanup-webhook-logs-daily',
  '0 3 * * *', -- Run at 3 AM daily
  $$SELECT public.cleanup_old_webhook_logs(30)$$
);