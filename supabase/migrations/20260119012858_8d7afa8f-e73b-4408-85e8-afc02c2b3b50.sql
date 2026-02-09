-- Restrict direct inserts to analytics_events - only service role can insert
-- This forces all inserts to go through the track-analytics edge function
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;

CREATE POLICY "Only service role can insert analytics events" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (
  -- Only allow inserts from service role (edge functions)
  -- This is checked by seeing if the request has no auth.uid() but still succeeds
  -- which only happens for service role
  auth.role() = 'service_role'
);

-- Restrict direct inserts to cookie_consent - only service role can insert
DROP POLICY IF EXISTS "Anyone can insert cookie consent" ON public.cookie_consent;

CREATE POLICY "Only service role can insert cookie consent" 
ON public.cookie_consent 
FOR INSERT 
WITH CHECK (
  auth.role() = 'service_role'
);