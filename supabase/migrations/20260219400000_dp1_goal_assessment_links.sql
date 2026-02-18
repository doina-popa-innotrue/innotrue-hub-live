-- DP1: Goal ↔ Assessment Traceability — links goals to assessment sources

CREATE TABLE public.goal_assessment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  -- Polymorphic: link to whichever assessment source
  capability_assessment_id UUID REFERENCES public.capability_assessments(id) ON DELETE SET NULL,
  capability_domain_id UUID REFERENCES public.capability_domains(id) ON DELETE SET NULL,
  capability_snapshot_id UUID REFERENCES public.capability_snapshots(id) ON DELETE SET NULL,
  assessment_definition_id UUID REFERENCES public.assessment_definitions(id) ON DELETE SET NULL,
  psychometric_assessment_id UUID REFERENCES public.psychometric_assessments(id) ON DELETE SET NULL,
  score_at_creation NUMERIC,
  target_score NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_id, capability_domain_id)
);

-- Indexes
CREATE INDEX idx_goal_assessment_links_goal ON public.goal_assessment_links(goal_id);
CREATE INDEX idx_goal_assessment_links_domain ON public.goal_assessment_links(capability_domain_id);

-- Enable RLS
ALTER TABLE public.goal_assessment_links ENABLE ROW LEVEL SECURITY;

-- Owner can manage links for their own goals
CREATE POLICY "Users can manage links for their own goals"
  ON public.goal_assessment_links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_assessment_links.goal_id
        AND goals.user_id = auth.uid()
    )
  );

-- Admin can view all
CREATE POLICY "Admins can view all goal assessment links"
  ON public.goal_assessment_links
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Shared users can view links for shared goals
CREATE POLICY "Shared users can view goal assessment links"
  ON public.goal_assessment_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_shares
      WHERE goal_shares.goal_id = goal_assessment_links.goal_id
        AND goal_shares.shared_with_user_id = auth.uid()
    )
  );

-- Coaches can view links for their clients' goals
CREATE POLICY "Coaches can view client goal assessment links"
  ON public.goal_assessment_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      JOIN public.client_coaches cc ON cc.client_id = g.user_id
      WHERE g.id = goal_assessment_links.goal_id
        AND cc.coach_id = auth.uid()
    )
  );

-- Instructors can view links for their clients' goals
CREATE POLICY "Instructors can view client goal assessment links"
  ON public.goal_assessment_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      JOIN public.client_instructors ci ON ci.client_id = g.user_id
      WHERE g.id = goal_assessment_links.goal_id
        AND ci.instructor_id = auth.uid()
    )
  );
