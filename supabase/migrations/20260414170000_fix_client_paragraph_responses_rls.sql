-- Fix: Clients cannot read their own paragraph responses after evaluation
--
-- Root cause: The "Clients can manage own responses" policy uses FOR ALL
-- with status IN ('draft', 'submitted'). Once the assignment moves to
-- 'in_review' or 'evaluated', the client is blocked from reading their
-- own responses — they see "No response provided" on the evaluated scenario.
--
-- Fix: Split into separate SELECT (always readable) and INSERT/UPDATE
-- (only in draft/submitted) policies.

-- Drop the overly restrictive FOR ALL policy
DROP POLICY IF EXISTS "Clients can manage own responses" ON public.paragraph_responses;

-- Clients can always READ their own responses (any status)
CREATE POLICY "Clients can read own responses"
ON public.paragraph_responses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    WHERE sa.id = paragraph_responses.assignment_id
    AND sa.user_id = auth.uid()
  )
);

-- Clients can INSERT responses only on draft assignments
CREATE POLICY "Clients can insert own responses"
ON public.paragraph_responses FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    WHERE sa.id = paragraph_responses.assignment_id
    AND sa.user_id = auth.uid()
    AND sa.status = 'draft'
  )
);

-- Clients can UPDATE responses on draft/submitted assignments
CREATE POLICY "Clients can update own responses"
ON public.paragraph_responses FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    WHERE sa.id = paragraph_responses.assignment_id
    AND sa.user_id = auth.uid()
    AND sa.status IN ('draft', 'submitted')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.scenario_assignments sa
    WHERE sa.id = paragraph_responses.assignment_id
    AND sa.user_id = auth.uid()
    AND sa.status IN ('draft', 'submitted')
  )
);
