-- Create organization_programs table for program licensing
CREATE TABLE public.organization_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  max_enrollments INTEGER DEFAULT NULL, -- NULL = unlimited
  notes TEXT,
  licensed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT NULL, -- NULL = never expires
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, program_id)
);

-- Enable RLS
ALTER TABLE public.organization_programs ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all organization programs
CREATE POLICY "Platform admins can manage organization programs"
  ON public.organization_programs
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Org admins can view their organization's licensed programs
CREATE POLICY "Org admins can view their licensed programs"
  ON public.organization_programs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_programs.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('org_admin', 'org_manager')
    )
  );

-- Create index for performance
CREATE INDEX idx_organization_programs_org_id ON public.organization_programs(organization_id);
CREATE INDEX idx_organization_programs_program_id ON public.organization_programs(program_id);

-- Add comment
COMMENT ON TABLE public.organization_programs IS 'Links organizations to programs they are licensed to access';