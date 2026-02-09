
-- Create coach access audit log table
CREATE TABLE public.coach_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  client_id UUID NOT NULL,
  access_type TEXT NOT NULL, -- 'view_profile', 'view_goals', 'view_decisions', 'view_tasks', 'view_assessments', 'view_progress'
  entity_type TEXT, -- Optional: specific entity type accessed
  entity_id UUID, -- Optional: specific entity ID accessed
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Add indexes for efficient querying
CREATE INDEX idx_coach_access_logs_coach ON public.coach_access_logs(coach_id);
CREATE INDEX idx_coach_access_logs_client ON public.coach_access_logs(client_id);
CREATE INDEX idx_coach_access_logs_accessed_at ON public.coach_access_logs(accessed_at DESC);
CREATE INDEX idx_coach_access_logs_access_type ON public.coach_access_logs(access_type);

-- Enable RLS
ALTER TABLE public.coach_access_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view coach access logs"
ON public.coach_access_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Coaches can insert their own access logs
CREATE POLICY "Coaches can log their access"
ON public.coach_access_logs FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = coach_id AND
  (public.has_role(auth.uid(), 'coach') OR public.has_role(auth.uid(), 'instructor'))
);

-- Clients can view logs about their own data being accessed
CREATE POLICY "Clients can view access to their data"
ON public.coach_access_logs FOR SELECT
TO authenticated
USING (auth.uid() = client_id);

-- Create coaching consent preferences table
CREATE TABLE public.coaching_consent_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  share_goals BOOLEAN NOT NULL DEFAULT false,
  share_decisions BOOLEAN NOT NULL DEFAULT false,
  share_tasks BOOLEAN NOT NULL DEFAULT false,
  share_progress BOOLEAN NOT NULL DEFAULT false,
  share_assessments BOOLEAN NOT NULL DEFAULT false,
  share_development_items BOOLEAN NOT NULL DEFAULT false,
  consent_given_at TIMESTAMP WITH TIME ZONE,
  consent_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coaching_consent_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own consent
CREATE POLICY "Users can view own consent preferences"
ON public.coaching_consent_preferences FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consent preferences"
ON public.coaching_consent_preferences FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consent preferences"
ON public.coaching_consent_preferences FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Coaches can view consent of their assigned clients
CREATE POLICY "Coaches can view assigned client consent"
ON public.coaching_consent_preferences FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_coaches cc
    WHERE cc.client_id = coaching_consent_preferences.user_id
    AND cc.coach_id = auth.uid()
  )
);

-- Staff can view all consent preferences
CREATE POLICY "Staff can view all consent preferences"
ON public.coaching_consent_preferences FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'instructor')
);

-- Create GDPR data export requests table
CREATE TABLE public.data_export_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'ready', 'downloaded', 'expired'
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  download_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

-- Users can view and create their own requests
CREATE POLICY "Users can view own data export requests"
ON public.data_export_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create data export requests"
ON public.data_export_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view and update all requests
CREATE POLICY "Admins can manage data export requests"
ON public.data_export_requests FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create cookie consent tracking table
CREATE TABLE public.cookie_consent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID, -- nullable for anonymous users
  session_id TEXT, -- for tracking anonymous consent
  necessary BOOLEAN NOT NULL DEFAULT true,
  analytics BOOLEAN NOT NULL DEFAULT false,
  marketing BOOLEAN NOT NULL DEFAULT false,
  consent_given_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.cookie_consent ENABLE ROW LEVEL SECURITY;

-- Users can manage their own cookie consent
CREATE POLICY "Users can view own cookie consent"
ON public.cookie_consent FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert cookie consent"
ON public.cookie_consent FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Users can update own cookie consent"
ON public.cookie_consent FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all cookie consent
CREATE POLICY "Admins can view all cookie consent"
ON public.cookie_consent FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add comments
COMMENT ON TABLE public.coach_access_logs IS 'Audit trail for coach access to client data';
COMMENT ON TABLE public.coaching_consent_preferences IS 'User preferences for what data to share with coaches';
COMMENT ON TABLE public.data_export_requests IS 'GDPR data export requests tracking';
COMMENT ON TABLE public.cookie_consent IS 'Cookie consent preferences for GDPR compliance';
