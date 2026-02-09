-- Table to configure which assessments are available for peer review in each group
CREATE TABLE public.group_peer_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.capability_assessments(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(group_id, assessment_id)
);

-- Enable RLS
ALTER TABLE public.group_peer_assessments ENABLE ROW LEVEL SECURITY;

-- Admins can manage peer assessment configurations
CREATE POLICY "Admins can manage group peer assessments"
  ON public.group_peer_assessments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Group members can view available peer assessments for their groups
CREATE POLICY "Group members can view peer assessments config"
  ON public.group_peer_assessments FOR SELECT
  USING (public.is_group_member(auth.uid(), group_id));

-- Add index for performance
CREATE INDEX idx_group_peer_assessments_group ON public.group_peer_assessments(group_id) WHERE is_active = true;

-- Add evaluation_relationship constraint to allow 'peer' type
-- (No constraint change needed, evaluation_relationship is already TEXT)

COMMENT ON TABLE public.group_peer_assessments IS 'Configures which capability assessments are available for peer review within each group';