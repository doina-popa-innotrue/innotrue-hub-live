-- DP4: Guided Path Instantiation — tracks template-to-goal creation lifecycle

CREATE TABLE public.guided_path_instantiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.guided_path_templates(id) ON DELETE SET NULL,
  survey_response_id UUID REFERENCES public.guided_path_survey_responses(id) ON DELETE SET NULL,
  pace_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  estimated_completion_date DATE,
  actual_completion_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_instantiations_user ON public.guided_path_instantiations(user_id);
CREATE INDEX idx_instantiations_template ON public.guided_path_instantiations(template_id);

ALTER TABLE public.guided_path_instantiations ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD
CREATE POLICY "Users can manage their own instantiations"
  ON public.guided_path_instantiations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Admin: SELECT all
CREATE POLICY "Admins can view all instantiations"
  ON public.guided_path_instantiations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Coaches: SELECT via client_coaches
CREATE POLICY "Coaches can view client instantiations"
  ON public.guided_path_instantiations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_coaches cc
      WHERE cc.client_id = guided_path_instantiations.user_id
        AND cc.coach_id = auth.uid()
    )
  );

-- Instructors: SELECT via client_instructors
CREATE POLICY "Instructors can view client instantiations"
  ON public.guided_path_instantiations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_instructors ci
      WHERE ci.client_id = guided_path_instantiations.user_id
        AND ci.instructor_id = auth.uid()
    )
  );

-- Add columns to goals table for template traceability
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS template_goal_id UUID REFERENCES public.guided_path_template_goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instantiation_id UUID REFERENCES public.guided_path_instantiations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goals_template_goal ON public.goals(template_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_instantiation ON public.goals(instantiation_id);
