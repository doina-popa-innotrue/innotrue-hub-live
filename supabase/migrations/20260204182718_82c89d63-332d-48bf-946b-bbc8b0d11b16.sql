
-- Fix staff_enrollments view to use SECURITY INVOKER
-- This ensures the view respects RLS policies of the querying user, not the view creator

DROP VIEW IF EXISTS public.staff_enrollments;

CREATE VIEW public.staff_enrollments
WITH (security_invoker=on) AS
SELECT 
    id,
    client_user_id,
    program_id,
    status,
    start_date,
    end_date,
    tier,
    created_at,
    updated_at,
    program_version_id,
    is_public,
    program_plan_id,
    cohort_id
FROM client_enrollments ce
WHERE (
    has_role(auth.uid(), 'admin'::app_role) 
    OR staff_has_client_relationship(auth.uid(), client_user_id) 
    OR (client_user_id = auth.uid())
);

COMMENT ON VIEW public.staff_enrollments IS 'Secure view of client_enrollments that excludes financial data (discount codes, payment info, credit costs) for staff access. Uses security_invoker to respect RLS policies.';
