-- Create guided_path_templates table
CREATE TABLE public.guided_path_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create guided_path_template_goals table
CREATE TABLE public.guided_path_template_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.guided_path_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  timeframe_type TEXT NOT NULL DEFAULT 'medium_term',
  priority TEXT NOT NULL DEFAULT 'medium',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create guided_path_template_milestones table
CREATE TABLE public.guided_path_template_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_goal_id UUID NOT NULL REFERENCES public.guided_path_template_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  recommended_days_min INTEGER, -- Minimum recommended days from previous milestone
  recommended_days_max INTEGER, -- Maximum recommended days from previous milestone
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create guided_path_template_tasks table
CREATE TABLE public.guided_path_template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_milestone_id UUID NOT NULL REFERENCES public.guided_path_template_milestones(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  importance BOOLEAN DEFAULT false,
  urgency BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.guided_path_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guided_path_template_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guided_path_template_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guided_path_template_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for guided_path_templates
-- Admins can do everything
CREATE POLICY "Admins can manage all templates"
ON public.guided_path_templates
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Clients can view active templates (general ones or for programs they're enrolled in)
CREATE POLICY "Clients can view active templates"
ON public.guided_path_templates
FOR SELECT
USING (
  is_active = true AND (
    program_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.client_enrollments ce
      WHERE ce.program_id = guided_path_templates.program_id
      AND ce.client_user_id = auth.uid()
      AND ce.status IN ('active', 'completed')
    )
  )
);

-- RLS Policies for guided_path_template_goals
CREATE POLICY "Admins can manage template goals"
ON public.guided_path_template_goals
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view goals of viewable templates"
ON public.guided_path_template_goals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.guided_path_templates t
    WHERE t.id = guided_path_template_goals.template_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (
        t.is_active = true AND (
          t.program_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.client_enrollments ce
            WHERE ce.program_id = t.program_id
            AND ce.client_user_id = auth.uid()
            AND ce.status IN ('active', 'completed')
          )
        )
      )
    )
  )
);

-- RLS Policies for guided_path_template_milestones
CREATE POLICY "Admins can manage template milestones"
ON public.guided_path_template_milestones
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view milestones of viewable templates"
ON public.guided_path_template_milestones
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.guided_path_template_goals g
    JOIN public.guided_path_templates t ON t.id = g.template_id
    WHERE g.id = guided_path_template_milestones.template_goal_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (
        t.is_active = true AND (
          t.program_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.client_enrollments ce
            WHERE ce.program_id = t.program_id
            AND ce.client_user_id = auth.uid()
            AND ce.status IN ('active', 'completed')
          )
        )
      )
    )
  )
);

-- RLS Policies for guided_path_template_tasks
CREATE POLICY "Admins can manage template tasks"
ON public.guided_path_template_tasks
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view tasks of viewable templates"
ON public.guided_path_template_tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.guided_path_template_milestones m
    JOIN public.guided_path_template_goals g ON g.id = m.template_goal_id
    JOIN public.guided_path_templates t ON t.id = g.template_id
    WHERE m.id = guided_path_template_tasks.template_milestone_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (
        t.is_active = true AND (
          t.program_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.client_enrollments ce
            WHERE ce.program_id = t.program_id
            AND ce.client_user_id = auth.uid()
            AND ce.status IN ('active', 'completed')
          )
        )
      )
    )
  )
);

-- Create updated_at trigger for templates
CREATE TRIGGER update_guided_path_templates_updated_at
BEFORE UPDATE ON public.guided_path_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_guided_path_templates_program_id ON public.guided_path_templates(program_id);
CREATE INDEX idx_guided_path_templates_is_active ON public.guided_path_templates(is_active);
CREATE INDEX idx_guided_path_template_goals_template_id ON public.guided_path_template_goals(template_id);
CREATE INDEX idx_guided_path_template_milestones_goal_id ON public.guided_path_template_milestones(template_goal_id);
CREATE INDEX idx_guided_path_template_tasks_milestone_id ON public.guided_path_template_tasks(template_milestone_id);