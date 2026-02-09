-- Fix staff_enrollments view to use SECURITY INVOKER instead of default SECURITY DEFINER
-- This ensures the view respects the querying user's permissions, not the view creator's

DROP VIEW IF EXISTS public.staff_enrollments;

CREATE VIEW public.staff_enrollments 
WITH (security_barrier = true, security_invoker = true) AS
SELECT 
    ce.id,
    ce.client_user_id,
    ce.program_id,
    ce.status,
    ce.start_date,
    ce.end_date,
    ce.tier,
    ce.created_at,
    ce.updated_at,
    ce.program_version_id,
    ce.is_public,
    ce.program_plan_id,
    ce.cohort_id,
    ce.managed_client_id
FROM client_enrollments ce
WHERE 
    -- Admins can see all enrollments
    public.has_role(auth.uid(), 'admin')
    -- Staff can only see enrollments for their assigned clients
    OR public.staff_has_client_relationship(auth.uid(), ce.client_user_id)
    -- Users can see their own enrollments
    OR ce.client_user_id = auth.uid();

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.staff_enrollments IS 'Restricted view of client_enrollments that hides sensitive financial data and limits access to authorized users only (admins, assigned staff, or record owner). Uses SECURITY INVOKER to respect querying user permissions.';

-- Grant select permission to authenticated users (the view's WHERE clause handles filtering)
GRANT SELECT ON public.staff_enrollments TO authenticated;