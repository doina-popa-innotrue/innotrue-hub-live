-- Fix infinite recursion: profiles → client_enrollments → profiles
--
-- The "Clients can view profiles of their program staff" policy on profiles
-- queries client_enrollments inline. When PostgreSQL evaluates client_enrollments
-- RLS policies, it re-evaluates profiles policies, causing infinite recursion.
--
-- Fix: wrap the client_enrollments lookup in a SECURITY DEFINER function
-- so it bypasses RLS on client_enrollments (same pattern as staff_has_client_relationship).

-- Create a function that checks if a client can view a staff member's profile
-- (i.e., the staff member is assigned to one of the client's programs)
CREATE OR REPLACE FUNCTION public.client_can_view_staff_profile(_client_id uuid, _staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Program instructor
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_instructors pi ON pi.program_id = ce.program_id
      WHERE ce.client_user_id = _client_id
        AND ce.status IN ('active', 'paused', 'completed')
        AND pi.instructor_id = _staff_id
    )
    OR
    -- Program coach
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_coaches pc ON pc.program_id = ce.program_id
      WHERE ce.client_user_id = _client_id
        AND ce.status IN ('active', 'paused', 'completed')
        AND pc.coach_id = _staff_id
    )
    OR
    -- Module instructor
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_modules pm ON pm.program_id = ce.program_id
      JOIN module_instructors mi ON mi.module_id = pm.id
      WHERE ce.client_user_id = _client_id
        AND ce.status IN ('active', 'paused', 'completed')
        AND mi.instructor_id = _staff_id
    )
    OR
    -- Module coach
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_modules pm ON pm.program_id = ce.program_id
      JOIN module_coaches mc ON mc.module_id = pm.id
      WHERE ce.client_user_id = _client_id
        AND ce.status IN ('active', 'paused', 'completed')
        AND mc.coach_id = _staff_id
    )
    OR
    -- Enrollment-level staff assignment
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN enrollment_module_staff ems ON ems.enrollment_id = ce.id
      WHERE ce.client_user_id = _client_id
        AND ce.status IN ('active', 'paused', 'completed')
        AND (ems.instructor_id = _staff_id OR ems.coach_id = _staff_id)
    )
$$;

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Clients can view profiles of their program staff" ON public.profiles;

-- Recreate using the SECURITY DEFINER function (bypasses RLS on client_enrollments)
CREATE POLICY "Clients can view profiles of their program staff"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.client_can_view_staff_profile(auth.uid(), id)
);
