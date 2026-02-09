-- Drop existing restrictive policy on capability_assessments
DROP POLICY IF EXISTS "Authenticated users can view active assessments" ON capability_assessments;

-- Create comprehensive policy for capability_assessments
-- Allows access for: public assessments (program_id IS NULL), enrolled users, or feature-entitled users
CREATE POLICY "Users can view accessible assessments"
ON capability_assessments
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    -- Public assessments (no program restriction)
    program_id IS NULL
    -- OR user is enrolled in the program
    OR EXISTS (
      SELECT 1 FROM client_enrollments ce
      WHERE ce.program_id = capability_assessments.program_id
        AND ce.client_user_id = auth.uid()
        AND ce.status IN ('active', 'completed')
    )
    -- OR user has the feature via any entitlement source
    OR (
      feature_key IS NOT NULL 
      AND public.user_has_feature(auth.uid(), feature_key)
    )
  )
);

-- Update domains policy to follow parent assessment access
DROP POLICY IF EXISTS "Authenticated users can view domains" ON capability_domains;

CREATE POLICY "Users can view domains for accessible assessments"
ON capability_domains
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM capability_assessments ca
    WHERE ca.id = capability_domains.assessment_id
      AND ca.is_active = true
      AND (
        ca.program_id IS NULL
        OR EXISTS (
          SELECT 1 FROM client_enrollments ce
          WHERE ce.program_id = ca.program_id
            AND ce.client_user_id = auth.uid()
            AND ce.status IN ('active', 'completed')
        )
        OR (
          ca.feature_key IS NOT NULL 
          AND public.user_has_feature(auth.uid(), ca.feature_key)
        )
      )
  )
);

-- Update questions policy similarly
DROP POLICY IF EXISTS "Authenticated users can view questions" ON capability_domain_questions;

CREATE POLICY "Users can view questions for accessible assessments"
ON capability_domain_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM capability_domains cd
    JOIN capability_assessments ca ON ca.id = cd.assessment_id
    WHERE cd.id = capability_domain_questions.domain_id
      AND ca.is_active = true
      AND (
        ca.program_id IS NULL
        OR EXISTS (
          SELECT 1 FROM client_enrollments ce
          WHERE ce.program_id = ca.program_id
            AND ce.client_user_id = auth.uid()
            AND ce.status IN ('active', 'completed')
        )
        OR (
          ca.feature_key IS NOT NULL 
          AND public.user_has_feature(auth.uid(), ca.feature_key)
        )
      )
  )
);