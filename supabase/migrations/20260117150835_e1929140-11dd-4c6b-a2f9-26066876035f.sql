-- Fix: Require authentication to view capability assessments
-- This prevents unauthenticated users from scraping proprietary assessment methodology

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can view active assessments" ON capability_assessments;
DROP POLICY IF EXISTS "Anyone can view domains of active assessments" ON capability_domains;
DROP POLICY IF EXISTS "Anyone can view questions of active assessments" ON capability_domain_questions;

-- Create new policies that require authentication
-- Authenticated users can view active, non-retired assessments (or public ones)
CREATE POLICY "Authenticated users can view active assessments"
ON capability_assessments
FOR SELECT
TO authenticated
USING (
  is_active = true 
  AND is_retired = false 
  AND (
    is_public = true 
    OR EXISTS (
      SELECT 1 FROM client_enrollments ce
      WHERE ce.client_user_id = auth.uid()
      AND ce.program_id = capability_assessments.program_id
      AND ce.status IN ('active', 'completed')
    )
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'instructor')
    OR has_role(auth.uid(), 'coach')
  )
);

-- Domains visible to authenticated users for viewable assessments
CREATE POLICY "Authenticated users can view domains"
ON capability_domains
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM capability_assessments ca
    WHERE ca.id = capability_domains.assessment_id
    AND ca.is_active = true
    AND ca.is_retired = false
    AND (
      ca.is_public = true
      OR EXISTS (
        SELECT 1 FROM client_enrollments ce
        WHERE ce.client_user_id = auth.uid()
        AND ce.program_id = ca.program_id
        AND ce.status IN ('active', 'completed')
      )
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'instructor')
      OR has_role(auth.uid(), 'coach')
    )
  )
);

-- Questions visible to authenticated users for viewable assessments
CREATE POLICY "Authenticated users can view questions"
ON capability_domain_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM capability_domains cd
    JOIN capability_assessments ca ON ca.id = cd.assessment_id
    WHERE cd.id = capability_domain_questions.domain_id
    AND ca.is_active = true
    AND ca.is_retired = false
    AND (
      ca.is_public = true
      OR EXISTS (
        SELECT 1 FROM client_enrollments ce
        WHERE ce.client_user_id = auth.uid()
        AND ce.program_id = ca.program_id
        AND ce.status IN ('active', 'completed')
      )
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'instructor')
      OR has_role(auth.uid(), 'coach')
    )
  )
);