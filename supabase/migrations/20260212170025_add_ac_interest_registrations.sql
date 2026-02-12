-- =============================================================================
-- Migration: Create ac_interest_registrations table
-- =============================================================================
-- Tracks user interest in programs based on assessment results.
-- Used on ClientDashboard to show pending program registrations.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ac_interest_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  program_name TEXT,
  assessment_result_id UUID REFERENCES public.ac_assessment_results(id) ON DELETE SET NULL,
  assessment_summary JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  enrollment_timeframe TEXT,
  notes TEXT,
  converted_at TIMESTAMPTZ,
  ac_contact_id TEXT,
  ac_automation_name TEXT,
  ac_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for dashboard query: user's pending registrations
CREATE INDEX IF NOT EXISTS idx_ac_interest_registrations_user_status
  ON public.ac_interest_registrations(user_id, status);

-- Index for lookups by assessment result
CREATE INDEX IF NOT EXISTS idx_ac_interest_registrations_assessment
  ON public.ac_interest_registrations(assessment_result_id);

-- Enable RLS
ALTER TABLE public.ac_interest_registrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own registrations
CREATE POLICY "Users can view own interest registrations"
  ON public.ac_interest_registrations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own registrations
CREATE POLICY "Users can create own interest registrations"
  ON public.ac_interest_registrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own registrations
CREATE POLICY "Users can update own interest registrations"
  ON public.ac_interest_registrations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can manage all registrations
CREATE POLICY "Admins can manage all interest registrations"
  ON public.ac_interest_registrations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Auto-update updated_at
CREATE TRIGGER update_ac_interest_registrations_updated_at
  BEFORE UPDATE ON public.ac_interest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
