-- DP3: Assessment-Gated Milestones — advisory readiness signals on guided paths

-- 1. Gate definitions on template milestones
CREATE TABLE public.guided_path_milestone_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_milestone_id UUID NOT NULL REFERENCES public.guided_path_template_milestones(id) ON DELETE CASCADE,
  -- Assessment source (exactly one set)
  capability_assessment_id UUID REFERENCES public.capability_assessments(id) ON DELETE CASCADE,
  capability_domain_id UUID REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  assessment_definition_id UUID REFERENCES public.assessment_definitions(id) ON DELETE CASCADE,
  assessment_dimension_id UUID REFERENCES public.assessment_dimensions(id) ON DELETE CASCADE,
  min_score NUMERIC NOT NULL,
  gate_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_milestone_gates_milestone ON public.guided_path_milestone_gates(template_milestone_id);

-- RLS: SELECT for all authenticated (templates are config data); CUD admin only
ALTER TABLE public.guided_path_milestone_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view milestone gates"
  ON public.guided_path_milestone_gates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage milestone gates"
  ON public.guided_path_milestone_gates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Gate overrides (coach/instructor/admin can waive gates)
CREATE TABLE public.milestone_gate_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_milestone_id UUID NOT NULL REFERENCES public.goal_milestones(id) ON DELETE CASCADE,
  gate_id UUID NOT NULL REFERENCES public.guided_path_milestone_gates(id) ON DELETE CASCADE,
  overridden_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_milestone_id, gate_id)
);

CREATE INDEX idx_gate_overrides_milestone ON public.milestone_gate_overrides(goal_milestone_id);

ALTER TABLE public.milestone_gate_overrides ENABLE ROW LEVEL SECURITY;

-- Goal owner can view overrides for their milestones
CREATE POLICY "Goal owners can view gate overrides"
  ON public.milestone_gate_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_milestones gm
      JOIN public.goals g ON g.id = gm.goal_id
      WHERE gm.id = milestone_gate_overrides.goal_milestone_id
        AND g.user_id = auth.uid()
    )
  );

-- Shared users can view overrides
CREATE POLICY "Shared users can view gate overrides"
  ON public.milestone_gate_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_milestones gm
      JOIN public.goal_shares gs ON gs.goal_id = gm.goal_id
      WHERE gm.id = milestone_gate_overrides.goal_milestone_id
        AND gs.shared_with_user_id = auth.uid()
    )
  );

-- Coaches can view and create overrides for their clients' milestones
CREATE POLICY "Coaches can view client gate overrides"
  ON public.milestone_gate_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_milestones gm
      JOIN public.goals g ON g.id = gm.goal_id
      JOIN public.client_coaches cc ON cc.client_id = g.user_id
      WHERE gm.id = milestone_gate_overrides.goal_milestone_id
        AND cc.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can create gate overrides"
  ON public.milestone_gate_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goal_milestones gm
      JOIN public.goals g ON g.id = gm.goal_id
      JOIN public.client_coaches cc ON cc.client_id = g.user_id
      WHERE gm.id = milestone_gate_overrides.goal_milestone_id
        AND cc.coach_id = auth.uid()
    )
  );

-- Instructors can view and create overrides for their clients' milestones
CREATE POLICY "Instructors can view client gate overrides"
  ON public.milestone_gate_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_milestones gm
      JOIN public.goals g ON g.id = gm.goal_id
      JOIN public.client_instructors ci ON ci.client_id = g.user_id
      WHERE gm.id = milestone_gate_overrides.goal_milestone_id
        AND ci.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can create gate overrides"
  ON public.milestone_gate_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goal_milestones gm
      JOIN public.goals g ON g.id = gm.goal_id
      JOIN public.client_instructors ci ON ci.client_id = g.user_id
      WHERE gm.id = milestone_gate_overrides.goal_milestone_id
        AND ci.instructor_id = auth.uid()
    )
  );

-- Admin can manage all overrides
CREATE POLICY "Admins can manage all gate overrides"
  ON public.milestone_gate_overrides
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
