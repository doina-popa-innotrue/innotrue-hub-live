-- Fix: storage policies still referenced the OLD bucket name
-- 'module-assessment-attachments' after the bucket was renamed to
-- 'module-assignment-attachments' (in migration 20251227193059).
-- This caused ALL storage uploads to fail with RLS violation,
-- regardless of the table-level policy fix.

-- =============================================================================
-- 1. Fix storage.objects policies — reference the CURRENT bucket name
-- =============================================================================

-- Drop old policies that reference the stale bucket name
DROP POLICY IF EXISTS "Authenticated users can upload assessment attachments"
  ON storage.objects;
DROP POLICY IF EXISTS "Users can view assessment attachments"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their assessment attachments"
  ON storage.objects;

-- Create replacement policies with the correct bucket name
CREATE POLICY "Authenticated users can upload assignment attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'module-assignment-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view assignment attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'module-assignment-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete their assignment attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'module-assignment-attachments' AND auth.uid() IS NOT NULL);

-- =============================================================================
-- 2. SECURITY DEFINER helper for table-level RLS
--    Bypasses nested RLS on module_assignments → module_progress →
--    client_enrollments, which can silently block the EXISTS subquery.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_assignment_owner(p_assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.module_assignments ma
    JOIN public.module_progress mp ON mp.id = ma.module_progress_id
    JOIN public.client_enrollments ce ON ce.id = mp.enrollment_id
    WHERE ma.id = p_assignment_id
      AND ce.client_user_id = auth.uid()
  );
$$;

-- =============================================================================
-- 3. Replace the inline-subquery table policy with the SECURITY DEFINER version
-- =============================================================================

DROP POLICY IF EXISTS "Assignment owners can manage their attachments"
  ON public.module_assignment_attachments;

CREATE POLICY "Assignment owners can manage their attachments"
ON public.module_assignment_attachments FOR ALL
USING (
  public.is_assignment_owner(assignment_id)
)
WITH CHECK (
  public.is_assignment_owner(assignment_id)
);
