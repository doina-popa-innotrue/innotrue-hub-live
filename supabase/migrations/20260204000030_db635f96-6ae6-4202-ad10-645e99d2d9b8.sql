-- Fix instructor RLS policies to restrict access to assigned clients only
-- Instructors should only see assignments/evaluations/scores for clients they're assigned to

-- 1. Drop and recreate scenario_assignments instructor policy
DROP POLICY IF EXISTS "Instructors can manage all assignments" ON scenario_assignments;
CREATE POLICY "Instructors can manage assignments for their clients"
ON scenario_assignments FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'instructor') AND 
  staff_has_client_relationship(auth.uid(), user_id)
)
WITH CHECK (
  has_role(auth.uid(), 'instructor') AND 
  staff_has_client_relationship(auth.uid(), user_id)
);

-- 2. Drop and recreate paragraph_responses instructor policy
DROP POLICY IF EXISTS "Instructors can view all responses" ON paragraph_responses;
CREATE POLICY "Instructors can view responses for their clients"
ON paragraph_responses FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'instructor') AND 
  EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.id = paragraph_responses.assignment_id
    AND staff_has_client_relationship(auth.uid(), sa.user_id)
  )
);

-- 3. Drop and recreate paragraph_evaluations instructor policy
DROP POLICY IF EXISTS "Instructors can manage all evaluations" ON paragraph_evaluations;
CREATE POLICY "Instructors can manage evaluations for their clients"
ON paragraph_evaluations FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'instructor') AND 
  EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.id = paragraph_evaluations.assignment_id
    AND staff_has_client_relationship(auth.uid(), sa.user_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'instructor') AND 
  EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.id = paragraph_evaluations.assignment_id
    AND staff_has_client_relationship(auth.uid(), sa.user_id)
  )
);

-- 4. Drop and recreate paragraph_question_scores instructor policy
DROP POLICY IF EXISTS "Instructors can manage all scores" ON paragraph_question_scores;
CREATE POLICY "Instructors can manage scores for their clients"
ON paragraph_question_scores FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'instructor') AND 
  EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.id = paragraph_question_scores.assignment_id
    AND staff_has_client_relationship(auth.uid(), sa.user_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'instructor') AND 
  EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.id = paragraph_question_scores.assignment_id
    AND staff_has_client_relationship(auth.uid(), sa.user_id)
  )
);