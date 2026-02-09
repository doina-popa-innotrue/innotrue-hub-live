-- Drop the conflicting policies and create clean ones
-- The issue is that with multiple permissive SELECT policies AND an ALL policy,
-- PostgreSQL can behave unexpectedly

-- First, let's drop all existing policies on client_enrollments
DROP POLICY IF EXISTS "Admins can manage all enrollments" ON public.client_enrollments;
DROP POLICY IF EXISTS "Authenticated users can view public enrollments for public prof" ON public.client_enrollments;
DROP POLICY IF EXISTS "Users can view enrollments they have access to" ON public.client_enrollments;
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.client_enrollments;

-- Create clean, consolidated policies

-- Admin full access (for all operations)
CREATE POLICY "Admins have full access to enrollments"
ON public.client_enrollments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own enrollments
CREATE POLICY "Users can view their own enrollments"
ON public.client_enrollments
FOR SELECT
TO authenticated
USING (client_user_id = auth.uid());

-- Instructors/Coaches can view program enrollments
CREATE POLICY "Staff can view program enrollments"
ON public.client_enrollments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM program_instructors pi
    WHERE pi.program_id = client_enrollments.program_id
    AND pi.instructor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM program_coaches pc
    WHERE pc.program_id = client_enrollments.program_id
    AND pc.coach_id = auth.uid()
  )
);

-- Org admins can view their organization's member enrollments
CREATE POLICY "Org admins can view member enrollments"
ON public.client_enrollments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om_viewer
    JOIN organization_members om_target 
      ON om_target.organization_id = om_viewer.organization_id
    WHERE om_viewer.user_id = auth.uid()
    AND om_viewer.role = 'org_admin'::org_role
    AND om_target.user_id = client_enrollments.client_user_id
  )
);

-- Public enrollments for program participants (with public profile)
CREATE POLICY "Users can view public enrollments of public profiles in shared programs"
ON public.client_enrollments
FOR SELECT
TO authenticated
USING (
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
);