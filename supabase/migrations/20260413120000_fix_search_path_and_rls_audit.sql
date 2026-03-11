-- Fix Supabase audit warnings:
-- 1. is_session_group_member: SECURITY DEFINER without SET search_path
-- 2. enrollment_module_staff UPDATE policy: WITH CHECK (true) allows row reassignment

-- =============================================================================
-- FIX 1: Add SET search_path to is_session_group_member (SECURITY DEFINER)
-- Table references are already schema-qualified, but best practice requires
-- explicit search_path to prevent auth.uid() from being shadowed.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_session_group_member(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_sessions gs
    JOIN public.group_memberships gm ON gm.group_id = gs.group_id
    WHERE gs.id = p_session_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
  );
$$;

-- =============================================================================
-- FIX 2: Tighten enrollment_module_staff UPDATE policy
-- Old: WITH CHECK (true) — staff could reassign rows to other users or change role
-- New: WITH CHECK (staff_user_id = auth.uid()) — staff can only update their own
--      rows and cannot transfer ownership away from themselves
-- =============================================================================
DROP POLICY IF EXISTS "Staff can update their assignments" ON public.enrollment_module_staff;

CREATE POLICY "Staff can update their assignments"
ON public.enrollment_module_staff
FOR UPDATE
TO authenticated
USING (staff_user_id = auth.uid())
WITH CHECK (staff_user_id = auth.uid());
