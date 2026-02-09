-- Update coach policies to use staff_has_client_relationship (consistent with instructors)

-- 1. scenario_assignments: Update coach policy
DROP POLICY IF EXISTS "Coaches can manage assignments for their clients" ON public.scenario_assignments;
CREATE POLICY "Coaches can manage assignments for their clients"
ON public.scenario_assignments
FOR ALL
USING (
  has_role(auth.uid(), 'coach'::app_role) 
  AND staff_has_client_relationship(auth.uid(), user_id)
)
WITH CHECK (
  has_role(auth.uid(), 'coach'::app_role) 
  AND staff_has_client_relationship(auth.uid(), user_id)
);

-- 2. paragraph_responses: Update coach policy
DROP POLICY IF EXISTS "Coaches can manage responses for their clients" ON public.paragraph_responses;
CREATE POLICY "Coaches can view responses for their clients"
ON public.paragraph_responses
FOR SELECT
USING (
  has_role(auth.uid(), 'coach'::app_role) 
  AND EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.id = paragraph_responses.assignment_id
    AND staff_has_client_relationship(auth.uid(), sa.user_id)
  )
);

-- 3. paragraph_evaluations: Update coach policy
DROP POLICY IF EXISTS "Coaches can manage evaluations for their clients" ON public.paragraph_evaluations;
CREATE POLICY "Coaches can manage evaluations for their clients"
ON public.paragraph_evaluations
FOR ALL
USING (
  has_role(auth.uid(), 'coach'::app_role) 
  AND EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.id = paragraph_evaluations.assignment_id
    AND staff_has_client_relationship(auth.uid(), sa.user_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'coach'::app_role) 
  AND EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.id = paragraph_evaluations.assignment_id
    AND staff_has_client_relationship(auth.uid(), sa.user_id)
  )
);

-- 4. paragraph_question_scores: Update coach policy
DROP POLICY IF EXISTS "Coaches can manage scores for their clients" ON public.paragraph_question_scores;
CREATE POLICY "Coaches can manage scores for their clients"
ON public.paragraph_question_scores
FOR ALL
USING (
  has_role(auth.uid(), 'coach'::app_role) 
  AND EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.id = paragraph_question_scores.assignment_id
    AND staff_has_client_relationship(auth.uid(), sa.user_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'coach'::app_role) 
  AND EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.id = paragraph_question_scores.assignment_id
    AND staff_has_client_relationship(auth.uid(), sa.user_id)
  )
);