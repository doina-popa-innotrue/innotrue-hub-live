-- Add coach management policies for scenario-based assessment system

-- SCENARIO TEMPLATES: Add coach management
CREATE POLICY "Coaches can manage scenario templates"
ON public.scenario_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'coach'));

-- SCENARIO SECTIONS: Add coach management
CREATE POLICY "Coaches can manage scenario sections"
ON public.scenario_sections FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'coach'));

-- SECTION PARAGRAPHS: Add coach management
CREATE POLICY "Coaches can manage section paragraphs"
ON public.section_paragraphs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'coach'));

-- PARAGRAPH QUESTION LINKS: Add coach management
CREATE POLICY "Coaches can manage paragraph question links"
ON public.paragraph_question_links FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'coach'));

-- SCENARIO ASSIGNMENTS: Add coach management for their clients
DROP POLICY IF EXISTS "Coaches can view assignments for their clients" ON public.scenario_assignments;
CREATE POLICY "Coaches can manage assignments for their clients"
ON public.scenario_assignments FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND EXISTS (
    SELECT 1 FROM public.client_coaches cc
    WHERE cc.client_id = scenario_assignments.user_id
    AND cc.coach_id = auth.uid()
  )
);

-- PARAGRAPH RESPONSES: Add coach management for their clients
DROP POLICY IF EXISTS "Coaches can view responses for their clients" ON public.paragraph_responses;
CREATE POLICY "Coaches can manage responses for their clients"
ON public.paragraph_responses FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    JOIN public.client_coaches cc ON cc.client_id = sa.user_id
    WHERE sa.id = paragraph_responses.assignment_id
    AND cc.coach_id = auth.uid()
  )
);

-- PARAGRAPH EVALUATIONS: Add coach management for their clients
DROP POLICY IF EXISTS "Coaches can view evaluations for their clients" ON public.paragraph_evaluations;
CREATE POLICY "Coaches can manage evaluations for their clients"
ON public.paragraph_evaluations FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    JOIN public.client_coaches cc ON cc.client_id = sa.user_id
    WHERE sa.id = paragraph_evaluations.assignment_id
    AND cc.coach_id = auth.uid()
  )
);

-- PARAGRAPH QUESTION SCORES: Add coach management for their clients
DROP POLICY IF EXISTS "Coaches can view scores for their clients" ON public.paragraph_question_scores;
CREATE POLICY "Coaches can manage scores for their clients"
ON public.paragraph_question_scores FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    JOIN public.client_coaches cc ON cc.client_id = sa.user_id
    WHERE sa.id = paragraph_question_scores.assignment_id
    AND cc.coach_id = auth.uid()
  )
);