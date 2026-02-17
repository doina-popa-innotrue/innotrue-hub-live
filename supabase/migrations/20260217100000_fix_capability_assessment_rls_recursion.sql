-- Fix: infinite recursion in capability_assessments RLS policies
-- The "Users can view accessible assessments" policy references client_enrollments,
-- which has its own RLS policy that self-references client_enrollments, causing
-- PostgreSQL error 42P17 "infinite recursion detected in policy for relation client_enrollments"
--
-- Solution: Create a SECURITY DEFINER helper function that checks enrollment
-- without triggering RLS on client_enrollments, then use it in the policies.

-- Helper function: checks if a user is enrolled in a program (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_is_enrolled_in_program(
  _user_id UUID,
  _program_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_enrollments
    WHERE client_user_id = _user_id
      AND program_id = _program_id
      AND status IN ('active', 'completed')
  )
$$;

-- Revoke direct execute from public, grant only to authenticated
REVOKE ALL ON FUNCTION public.user_is_enrolled_in_program(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_enrolled_in_program(UUID, UUID) TO authenticated;

-- ============================================================
-- Fix capability_assessments SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Users can view accessible assessments" ON capability_assessments;

CREATE POLICY "Users can view accessible assessments"
ON capability_assessments
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    -- Public assessments (no program restriction)
    program_id IS NULL
    -- OR user is enrolled in the program (via SECURITY DEFINER to avoid recursion)
    OR public.user_is_enrolled_in_program(auth.uid(), program_id)
    -- OR user has the feature via any entitlement source
    OR (
      feature_key IS NOT NULL
      AND public.user_has_feature(auth.uid(), feature_key)
    )
  )
);

-- ============================================================
-- Fix capability_domains SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Users can view domains for accessible assessments" ON capability_domains;

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
        OR public.user_is_enrolled_in_program(auth.uid(), ca.program_id)
        OR (
          ca.feature_key IS NOT NULL
          AND public.user_has_feature(auth.uid(), ca.feature_key)
        )
      )
  )
);

-- ============================================================
-- Fix capability_domain_questions SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Users can view questions for accessible assessments" ON capability_domain_questions;

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
        OR public.user_is_enrolled_in_program(auth.uid(), ca.program_id)
        OR (
          ca.feature_key IS NOT NULL
          AND public.user_has_feature(auth.uid(), ca.feature_key)
        )
      )
  )
);
