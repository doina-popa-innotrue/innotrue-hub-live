-- Remove the overly permissive public access policy
DROP POLICY IF EXISTS "Anyone can view public enrollments for public profiles" ON public.client_enrollments;

-- Create a new policy that requires authentication and restricts to proper relationships
-- Public enrollments can only be viewed by authenticated users who have a legitimate reason
CREATE POLICY "Authenticated users can view public enrollments for public profiles"
ON public.client_enrollments
FOR SELECT
USING (
  -- Must be authenticated
  auth.uid() IS NOT NULL
  AND (
    -- User's own enrollments
    client_user_id = auth.uid()
    -- OR admin access
    OR has_role(auth.uid(), 'admin'::app_role)
    -- OR instructor/coach of the program
    OR EXISTS (
      SELECT 1 FROM program_instructors pi
      WHERE pi.program_id = client_enrollments.program_id
      AND pi.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM program_coaches pc
      WHERE pc.program_id = client_enrollments.program_id
      AND pc.coach_id = auth.uid()
    )
    -- OR organization admin viewing their org members' enrollments
    OR EXISTS (
      SELECT 1 FROM organization_members om_viewer
      JOIN organization_members om_target ON om_target.organization_id = om_viewer.organization_id
      WHERE om_viewer.user_id = auth.uid()
      AND om_viewer.role = 'org_admin'::org_role
      AND om_target.user_id = client_enrollments.client_user_id
    )
    -- OR fellow program participant viewing public enrollments (must be enrolled in same program)
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public_profile_settings pps
        WHERE pps.user_id = client_enrollments.client_user_id
        AND pps.is_public = true
      )
      AND EXISTS (
        SELECT 1 FROM client_enrollments ce2
        WHERE ce2.client_user_id = auth.uid()
        AND ce2.program_id = client_enrollments.program_id
        AND ce2.status IN ('active', 'completed')
      )
    )
  )
);