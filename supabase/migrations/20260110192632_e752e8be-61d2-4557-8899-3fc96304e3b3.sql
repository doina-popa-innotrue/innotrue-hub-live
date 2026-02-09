-- Assessment framework tables

-- Main assessment definitions
CREATE TABLE public.assessment_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Assessment dimensions (e.g., "Strategic Thinking", "Team Leadership")
CREATE TABLE public.assessment_dimensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessment_definitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Assessment questions
CREATE TABLE public.assessment_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessment_definitions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'single_choice',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Question options with dimension scoring
CREATE TABLE public.assessment_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Option to dimension scoring (which dimensions an option contributes to)
CREATE TABLE public.assessment_option_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id UUID NOT NULL REFERENCES public.assessment_options(id) ON DELETE CASCADE,
  dimension_id UUID NOT NULL REFERENCES public.assessment_dimensions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(option_id, dimension_id)
);

-- Interpretation rules based on dimension scores
CREATE TABLE public.assessment_interpretations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessment_definitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  interpretation_text TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Store user assessment responses
CREATE TABLE public.assessment_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessment_definitions(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT,
  name TEXT,
  responses JSONB NOT NULL DEFAULT '{}',
  dimension_scores JSONB NOT NULL DEFAULT '{}',
  interpretations JSONB NOT NULL DEFAULT '[]',
  newsletter_consent BOOLEAN DEFAULT false,
  plan_interest TEXT,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assessment_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_option_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;

-- Public read for active assessments (for public assessment pages)
CREATE POLICY "Public can view active assessments" ON public.assessment_definitions
  FOR SELECT USING (is_active = true AND is_public = true);

CREATE POLICY "Public can view dimensions of active assessments" ON public.assessment_dimensions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assessment_definitions 
      WHERE id = assessment_id AND is_active = true AND is_public = true
    )
  );

CREATE POLICY "Public can view questions of active assessments" ON public.assessment_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assessment_definitions 
      WHERE id = assessment_id AND is_active = true AND is_public = true
    )
  );

CREATE POLICY "Public can view options of active assessments" ON public.assessment_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assessment_questions q
      JOIN public.assessment_definitions a ON a.id = q.assessment_id
      WHERE q.id = question_id AND a.is_active = true AND a.is_public = true
    )
  );

CREATE POLICY "Public can view option scores of active assessments" ON public.assessment_option_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assessment_options o
      JOIN public.assessment_questions q ON q.id = o.question_id
      JOIN public.assessment_definitions a ON a.id = q.assessment_id
      WHERE o.id = option_id AND a.is_active = true AND a.is_public = true
    )
  );

CREATE POLICY "Public can view interpretations of active assessments" ON public.assessment_interpretations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assessment_definitions 
      WHERE id = assessment_id AND is_active = true AND is_public = true
    )
  );

-- Public can insert responses
CREATE POLICY "Public can submit assessment responses" ON public.assessment_responses
  FOR INSERT WITH CHECK (true);

-- Users can view their own responses
CREATE POLICY "Users can view own responses" ON public.assessment_responses
  FOR SELECT USING (auth.uid() = user_id);

-- Admin full access (assuming admin check via user_roles)
CREATE POLICY "Admins can manage assessment definitions" ON public.assessment_definitions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage dimensions" ON public.assessment_dimensions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage questions" ON public.assessment_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage options" ON public.assessment_options
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage option scores" ON public.assessment_option_scores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage interpretations" ON public.assessment_interpretations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can view all responses" ON public.assessment_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Triggers for updated_at
CREATE TRIGGER update_assessment_definitions_updated_at
  BEFORE UPDATE ON public.assessment_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();