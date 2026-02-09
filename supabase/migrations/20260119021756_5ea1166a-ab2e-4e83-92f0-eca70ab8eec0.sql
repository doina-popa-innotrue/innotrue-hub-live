-- Add optimal days to existing milestone templates
ALTER TABLE public.guided_path_template_milestones 
ADD COLUMN IF NOT EXISTS recommended_days_optimal INTEGER;

-- Create template families (groups of related path templates with surveys)
CREATE TABLE public.guided_path_template_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Survey questions for each family
CREATE TABLE public.family_survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.guided_path_template_families(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'boolean', -- boolean, single_choice, multi_choice, date
  options JSONB, -- For choice questions: [{"value": "not_scheduled", "label": "Not yet scheduled"}, ...]
  help_text TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link templates to families with conditions
ALTER TABLE public.guided_path_templates 
ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.guided_path_template_families(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_base_template BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS order_in_family INTEGER NOT NULL DEFAULT 0;

-- Conditions that determine when a template block is included
CREATE TABLE public.template_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.guided_path_templates(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.family_survey_questions(id) ON DELETE CASCADE,
  operator TEXT NOT NULL DEFAULT 'equals', -- equals, not_equals, in, not_in, before, after
  value JSONB NOT NULL, -- The value(s) to compare against
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, question_id)
);

-- Store user survey responses when they start a guided path
CREATE TABLE public.guided_path_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.guided_path_template_families(id) ON DELETE CASCADE,
  responses JSONB NOT NULL DEFAULT '{}', -- {question_id: answer_value, ...}
  selected_template_ids UUID[] NOT NULL DEFAULT '{}', -- Templates that matched conditions
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guided_path_template_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guided_path_survey_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for families (public read, admin write)
CREATE POLICY "Anyone can view active families"
ON public.guided_path_template_families FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage families"
ON public.guided_path_template_families FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for survey questions
CREATE POLICY "Anyone can view survey questions"
ON public.family_survey_questions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage survey questions"
ON public.family_survey_questions FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for template conditions
CREATE POLICY "Anyone can view template conditions"
ON public.template_conditions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage template conditions"
ON public.template_conditions FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for survey responses
CREATE POLICY "Users can view own survey responses"
ON public.guided_path_survey_responses FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own survey responses"
ON public.guided_path_survey_responses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own survey responses"
ON public.guided_path_survey_responses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own survey responses"
ON public.guided_path_survey_responses FOR DELETE
USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_guided_path_template_families_updated_at
BEFORE UPDATE ON public.guided_path_template_families
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guided_path_survey_responses_updated_at
BEFORE UPDATE ON public.guided_path_survey_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_family_survey_questions_family ON public.family_survey_questions(family_id);
CREATE INDEX idx_template_conditions_template ON public.template_conditions(template_id);
CREATE INDEX idx_template_conditions_question ON public.template_conditions(question_id);
CREATE INDEX idx_guided_path_templates_family ON public.guided_path_templates(family_id);
CREATE INDEX idx_guided_path_survey_responses_user ON public.guided_path_survey_responses(user_id);
CREATE INDEX idx_guided_path_survey_responses_family ON public.guided_path_survey_responses(family_id);