-- Phase 5 remaining + R4: Coach client invites
-- 1. coach_client_invites table for R4
-- 2. Indexes for new tables

-- ============================================================
-- R4: Coach Client Invites
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coach_client_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  message TEXT,
  token UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  linked_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coach_client_invites_coach_id
  ON public.coach_client_invites(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_invites_email
  ON public.coach_client_invites(email);
CREATE INDEX IF NOT EXISTS idx_coach_client_invites_token
  ON public.coach_client_invites(token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coach_client_invites_status
  ON public.coach_client_invites(status) WHERE status = 'pending';

-- RLS
ALTER TABLE public.coach_client_invites ENABLE ROW LEVEL SECURITY;

-- Coaches can manage their own invites
CREATE POLICY "Coaches manage own invites"
  ON public.coach_client_invites
  FOR ALL
  USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Clients can see invites addressed to them (for acceptance flow)
CREATE POLICY "Clients view own invites by email"
  ON public.coach_client_invites
  FOR SELECT
  USING (
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_coach_client_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coach_client_invites_updated_at
  BEFORE UPDATE ON public.coach_client_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_coach_client_invites_updated_at();
