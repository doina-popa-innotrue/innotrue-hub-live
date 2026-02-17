-- Fix: cross-table RLS recursion cycle
-- client_enrollments "Staff can view enrollments" → queries program_instructors/program_coaches
-- program_instructors "Enrolled clients can view..." → queries client_enrollments → RECURSION
--
-- Solution: Replace the program_instructors and program_coaches client-facing policies
-- to use the user_is_enrolled_in_program() SECURITY DEFINER function (created in
-- 20260217100000) instead of querying client_enrollments directly.
-- This breaks the cycle for ALL tables whose policies reference client_enrollments.

-- First, update user_is_enrolled_in_program() to also include 'paused' status,
-- since the original program_instructors/coaches policies allowed paused enrollments
-- to view staff, and paused users should still see their program data.
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
      AND status IN ('active', 'paused', 'completed')
  )
$$;

-- ============================================================
-- Fix program_instructors: enrolled clients policy
-- ============================================================
DROP POLICY IF EXISTS "Enrolled clients can view program instructors" ON public.program_instructors;

CREATE POLICY "Enrolled clients can view program instructors"
ON public.program_instructors
FOR SELECT
USING (
  public.user_is_enrolled_in_program(auth.uid(), program_id)
);

-- ============================================================
-- Fix program_coaches: enrolled clients policy
-- ============================================================
DROP POLICY IF EXISTS "Enrolled clients can view program coaches" ON public.program_coaches;

CREATE POLICY "Enrolled clients can view program coaches"
ON public.program_coaches
FOR SELECT
USING (
  public.user_is_enrolled_in_program(auth.uid(), program_id)
);
