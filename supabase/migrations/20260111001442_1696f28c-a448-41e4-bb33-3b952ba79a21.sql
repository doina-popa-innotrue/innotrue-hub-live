-- Fix overly permissive INSERT policy on activecampaign_sync_logs
-- This table should only be written to by admins or edge functions (service role)

DROP POLICY IF EXISTS "Service role can insert sync logs" ON public.activecampaign_sync_logs;

-- Only admins can insert sync logs (service role bypasses RLS anyway)
CREATE POLICY "Admins can insert sync logs" 
ON public.activecampaign_sync_logs 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));