-- ============================================================================
-- SCENARIO-BASED ASSESSMENT SYSTEM
-- Dynamic scoring based on linked capability_assessment.rating_scale
-- ============================================================================

-- 1. SCENARIO TEMPLATES (Master scenario records)
CREATE TABLE public.scenario_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  capability_assessment_id UUID REFERENCES public.capability_assessments(id) ON DELETE SET NULL,
  is_protected BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. SCENARIO SECTIONS (Paginated sections with instructions)
CREATE TABLE public.scenario_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.scenario_templates(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  order_index INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. SECTION PARAGRAPHS (Individual content blocks)
CREATE TABLE public.section_paragraphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES public.scenario_sections(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  order_index INTEGER DEFAULT 0 NOT NULL,
  requires_response BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. PARAGRAPH QUESTION LINKS (Map paragraphs to capability domain questions)
CREATE TABLE public.paragraph_question_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paragraph_id UUID REFERENCES public.section_paragraphs(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.capability_domain_questions(id) ON DELETE CASCADE NOT NULL,
  weight NUMERIC(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(paragraph_id, question_id)
);

-- 5. SCENARIO ASSIGNMENTS (Track client assignment lifecycle)
CREATE TABLE public.scenario_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.scenario_templates(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.client_enrollments(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'submitted', 'in_review', 'evaluated')),
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  submitted_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ,
  evaluated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  overall_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(template_id, user_id, enrollment_id)
);

-- 6. PARAGRAPH RESPONSES (Client rich-text answers)
CREATE TABLE public.paragraph_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.scenario_assignments(id) ON DELETE CASCADE NOT NULL,
  paragraph_id UUID REFERENCES public.section_paragraphs(id) ON DELETE CASCADE NOT NULL,
  response_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(assignment_id, paragraph_id)
);

-- 7. PARAGRAPH EVALUATIONS (Instructor feedback per paragraph)
CREATE TABLE public.paragraph_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.scenario_assignments(id) ON DELETE CASCADE NOT NULL,
  paragraph_id UUID REFERENCES public.section_paragraphs(id) ON DELETE CASCADE NOT NULL,
  evaluator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(assignment_id, paragraph_id)
);

-- 8. PARAGRAPH QUESTION SCORES (Granular ratings per question per paragraph)
-- Score validation handled by trigger to respect dynamic rating_scale
CREATE TABLE public.paragraph_question_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.scenario_assignments(id) ON DELETE CASCADE NOT NULL,
  paragraph_id UUID REFERENCES public.section_paragraphs(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.capability_domain_questions(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  evaluator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(assignment_id, paragraph_id, question_id)
);

-- ============================================================================
-- SCORE VALIDATION TRIGGER (Dynamic based on rating_scale)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_paragraph_question_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_score INTEGER;
BEGIN
  -- Get the rating_scale from the linked capability_assessment via template
  SELECT ca.rating_scale INTO max_score
  FROM paragraph_question_links pql
  JOIN section_paragraphs sp ON sp.id = pql.paragraph_id
  JOIN scenario_sections ss ON ss.id = sp.section_id
  JOIN scenario_templates st ON st.id = ss.template_id
  JOIN capability_assessments ca ON ca.id = st.capability_assessment_id
  WHERE pql.paragraph_id = NEW.paragraph_id
    AND pql.question_id = NEW.question_id
  LIMIT 1;

  -- Default to 5 if no linked assessment
  IF max_score IS NULL THEN
    max_score := 5;
  END IF;

  -- Validate score range
  IF NEW.score < 0 OR NEW.score > max_score THEN
    RAISE EXCEPTION 'Score must be between 0 and % (based on assessment rating_scale)', max_score;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_score_before_insert_update
BEFORE INSERT OR UPDATE ON public.paragraph_question_scores
FOR EACH ROW
EXECUTE FUNCTION public.validate_paragraph_question_score();

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER update_scenario_templates_updated_at
BEFORE UPDATE ON public.scenario_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scenario_sections_updated_at
BEFORE UPDATE ON public.scenario_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_section_paragraphs_updated_at
BEFORE UPDATE ON public.section_paragraphs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scenario_assignments_updated_at
BEFORE UPDATE ON public.scenario_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_paragraph_responses_updated_at
BEFORE UPDATE ON public.paragraph_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_paragraph_evaluations_updated_at
BEFORE UPDATE ON public.paragraph_evaluations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_paragraph_question_scores_updated_at
BEFORE UPDATE ON public.paragraph_question_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX idx_scenario_sections_template ON public.scenario_sections(template_id);
CREATE INDEX idx_section_paragraphs_section ON public.section_paragraphs(section_id);
CREATE INDEX idx_paragraph_question_links_paragraph ON public.paragraph_question_links(paragraph_id);
CREATE INDEX idx_paragraph_question_links_question ON public.paragraph_question_links(question_id);
CREATE INDEX idx_scenario_assignments_user ON public.scenario_assignments(user_id);
CREATE INDEX idx_scenario_assignments_template ON public.scenario_assignments(template_id);
CREATE INDEX idx_scenario_assignments_status ON public.scenario_assignments(status);
CREATE INDEX idx_paragraph_responses_assignment ON public.paragraph_responses(assignment_id);
CREATE INDEX idx_paragraph_evaluations_assignment ON public.paragraph_evaluations(assignment_id);
CREATE INDEX idx_paragraph_question_scores_assignment ON public.paragraph_question_scores(assignment_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.scenario_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_paragraphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paragraph_question_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paragraph_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paragraph_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paragraph_question_scores ENABLE ROW LEVEL SECURITY;

-- SCENARIO TEMPLATES: Admins/instructors manage, clients view if assigned
CREATE POLICY "Admins can manage scenario templates"
ON public.scenario_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can manage scenario templates"
ON public.scenario_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Clients can view templates they are assigned to"
ON public.scenario_templates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    WHERE sa.template_id = scenario_templates.id
    AND sa.user_id = auth.uid()
  )
);

-- SCENARIO SECTIONS: Follows template access
CREATE POLICY "Admins can manage scenario sections"
ON public.scenario_sections FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can manage scenario sections"
ON public.scenario_sections FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Clients can view sections of assigned templates"
ON public.scenario_sections FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    WHERE sa.template_id = scenario_sections.template_id
    AND sa.user_id = auth.uid()
  )
);

-- SECTION PARAGRAPHS: Follows section access
CREATE POLICY "Admins can manage section paragraphs"
ON public.section_paragraphs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can manage section paragraphs"
ON public.section_paragraphs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Clients can view paragraphs of assigned templates"
ON public.section_paragraphs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scenario_sections ss
    JOIN public.scenario_assignments sa ON sa.template_id = ss.template_id
    WHERE ss.id = section_paragraphs.section_id
    AND sa.user_id = auth.uid()
  )
);

-- PARAGRAPH QUESTION LINKS: Admin/instructor manage, clients view
CREATE POLICY "Admins can manage paragraph question links"
ON public.paragraph_question_links FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can manage paragraph question links"
ON public.paragraph_question_links FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Clients can view paragraph question links for assigned templates"
ON public.paragraph_question_links FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.section_paragraphs sp
    JOIN public.scenario_sections ss ON ss.id = sp.section_id
    JOIN public.scenario_assignments sa ON sa.template_id = ss.template_id
    WHERE sp.id = paragraph_question_links.paragraph_id
    AND sa.user_id = auth.uid()
  )
);

-- SCENARIO ASSIGNMENTS: Admin/instructor manage, clients view/update own
CREATE POLICY "Admins can manage all assignments"
ON public.scenario_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can manage all assignments"
ON public.scenario_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Coaches can view assignments for their clients"
ON public.scenario_assignments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND EXISTS (
    SELECT 1 FROM public.client_coaches cc
    WHERE cc.client_id = scenario_assignments.user_id
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Clients can view own assignments"
ON public.scenario_assignments FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Clients can update own draft assignments"
ON public.scenario_assignments FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status IN ('draft', 'submitted'))
WITH CHECK (user_id = auth.uid());

-- PARAGRAPH RESPONSES: Clients manage own, staff view
CREATE POLICY "Admins can manage all responses"
ON public.paragraph_responses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view all responses"
ON public.paragraph_responses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Coaches can view responses for their clients"
ON public.paragraph_responses FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    JOIN public.client_coaches cc ON cc.client_id = sa.user_id
    WHERE sa.id = paragraph_responses.assignment_id
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Clients can manage own responses"
ON public.paragraph_responses FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    WHERE sa.id = paragraph_responses.assignment_id
    AND sa.user_id = auth.uid()
    AND sa.status IN ('draft', 'submitted')
  )
);

-- PARAGRAPH EVALUATIONS: Admin/instructor manage, clients view own
CREATE POLICY "Admins can manage all evaluations"
ON public.paragraph_evaluations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can manage all evaluations"
ON public.paragraph_evaluations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Coaches can view evaluations for their clients"
ON public.paragraph_evaluations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    JOIN public.client_coaches cc ON cc.client_id = sa.user_id
    WHERE sa.id = paragraph_evaluations.assignment_id
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Clients can view own evaluations when evaluated"
ON public.paragraph_evaluations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    WHERE sa.id = paragraph_evaluations.assignment_id
    AND sa.user_id = auth.uid()
    AND sa.status = 'evaluated'
  )
);

-- PARAGRAPH QUESTION SCORES: Admin/instructor manage, clients view own
CREATE POLICY "Admins can manage all scores"
ON public.paragraph_question_scores FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can manage all scores"
ON public.paragraph_question_scores FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Coaches can view scores for their clients"
ON public.paragraph_question_scores FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    JOIN public.client_coaches cc ON cc.client_id = sa.user_id
    WHERE sa.id = paragraph_question_scores.assignment_id
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Clients can view own scores when evaluated"
ON public.paragraph_question_scores FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    WHERE sa.id = paragraph_question_scores.assignment_id
    AND sa.user_id = auth.uid()
    AND sa.status = 'evaluated'
  )
);