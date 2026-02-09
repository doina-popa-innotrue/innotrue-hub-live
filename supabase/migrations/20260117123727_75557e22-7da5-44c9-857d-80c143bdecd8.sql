-- Organization sharing consent preferences (similar to coaching consent but for org visibility)
CREATE TABLE public.organization_sharing_consent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  share_goals BOOLEAN NOT NULL DEFAULT false,
  share_decisions BOOLEAN NOT NULL DEFAULT false,
  share_tasks BOOLEAN NOT NULL DEFAULT false,
  share_progress BOOLEAN NOT NULL DEFAULT false,
  share_assessments BOOLEAN NOT NULL DEFAULT false,
  share_development_items BOOLEAN NOT NULL DEFAULT false,
  share_assignments BOOLEAN NOT NULL DEFAULT false,
  consent_given_at TIMESTAMPTZ,
  consent_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.organization_sharing_consent ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own org sharing consent
CREATE POLICY "Users can manage their own org sharing consent"
  ON public.organization_sharing_consent
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Org admins/managers can view consent status for their org members (read-only)
CREATE POLICY "Org admins can view member consent status"
  ON public.organization_sharing_consent
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_sharing_consent.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('org_admin', 'org_manager')
    )
  );

-- Organization-specific terms and conditions
CREATE TABLE public.organization_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  is_blocking_on_first_access BOOLEAN NOT NULL DEFAULT true,
  is_blocking_on_update BOOLEAN NOT NULL DEFAULT false,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(organization_id, version)
);

-- Enable RLS
ALTER TABLE public.organization_terms ENABLE ROW LEVEL SECURITY;

-- Anyone in the org can view terms
CREATE POLICY "Org members can view terms"
  ON public.organization_terms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_terms.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Only org admins can manage terms
CREATE POLICY "Org admins can manage terms"
  ON public.organization_terms
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_terms.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'org_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_terms.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'org_admin'
    )
  );

-- User acceptance of organization terms
CREATE TABLE public.user_organization_terms_acceptance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_terms_id UUID NOT NULL REFERENCES public.organization_terms(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  content_hash TEXT NOT NULL,
  UNIQUE(user_id, organization_terms_id)
);

-- Enable RLS
ALTER TABLE public.user_organization_terms_acceptance ENABLE ROW LEVEL SECURITY;

-- Users can view and create their own acceptances
CREATE POLICY "Users can manage their own terms acceptance"
  ON public.user_organization_terms_acceptance
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Org admins can view acceptance records for their org
CREATE POLICY "Org admins can view acceptance records"
  ON public.user_organization_terms_acceptance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_terms ot
      JOIN public.organization_members om ON om.organization_id = ot.organization_id
      WHERE ot.id = user_organization_terms_acceptance.organization_terms_id
      AND om.user_id = auth.uid()
      AND om.role IN ('org_admin', 'org_manager')
    )
  );

-- Trigger to ensure only one current version per organization
CREATE OR REPLACE FUNCTION public.handle_org_terms_current_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.organization_terms
    SET is_current = false
    WHERE organization_id = NEW.organization_id
    AND id != NEW.id
    AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_org_terms_current_version
  BEFORE INSERT OR UPDATE ON public.organization_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_org_terms_current_version();