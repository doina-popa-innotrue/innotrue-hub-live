-- Create organization_invites table for pending invitations
CREATE TABLE public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.org_role NOT NULL DEFAULT 'org_member',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, email)
);

-- Enable RLS
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all invites
CREATE POLICY "Platform admins can manage all invites"
  ON public.organization_invites
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Org admins/managers can view and create invites for their org
CREATE POLICY "Org admins can manage their org invites"
  ON public.organization_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_invites.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('org_admin', 'org_manager')
    )
  );

-- Anyone can view invite by token (for accepting)
CREATE POLICY "Anyone can view invite by token"
  ON public.organization_invites
  FOR SELECT
  USING (true);

-- Create indexes
CREATE INDEX idx_organization_invites_org_id ON public.organization_invites(organization_id);
CREATE INDEX idx_organization_invites_email ON public.organization_invites(email);
CREATE INDEX idx_organization_invites_token ON public.organization_invites(token);

-- Add comment
COMMENT ON TABLE public.organization_invites IS 'Pending invitations to join organizations';