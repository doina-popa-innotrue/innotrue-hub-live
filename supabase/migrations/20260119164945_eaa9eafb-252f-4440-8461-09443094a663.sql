-- Fix infinite recursion in client_enrollments RLS by moving self-referential checks into SECURITY DEFINER helpers

-- Helper: is viewer an active/completed participant in a program?
CREATE OR REPLACE FUNCTION public.is_program_participant(_viewer_id uuid, _program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_enrollments ce
    WHERE ce.client_user_id = _viewer_id
      AND ce.program_id = _program_id
      AND ce.status IN ('active'::public.enrollment_status, 'completed'::public.enrollment_status)
  )
$$;

-- Replace the policy that caused recursion
DROP POLICY IF EXISTS "Users can view public enrollments of public profiles in shared programs" ON public.client_enrollments;

CREATE POLICY "Users can view public enrollments of public profiles in shared programs"
ON public.client_enrollments
FOR SELECT
TO authenticated
USING (
  is_public = true
  AND EXISTS (
    SELECT 1
    FROM public.public_profile_settings pps
    WHERE pps.user_id = client_enrollments.client_user_id
      AND pps.is_public = true
  )
  AND public.is_program_participant(auth.uid(), client_enrollments.program_id)
);
