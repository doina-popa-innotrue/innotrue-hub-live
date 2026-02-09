-- Drop the staff_enrollments view first
DROP VIEW IF EXISTS public.staff_enrollments;

-- Drop policies on managed_clients that depend on client_enrollments.managed_client_id
DROP POLICY IF EXISTS "Instructors can view managed_clients in their programs" ON public.managed_clients;

-- Drop the managed_clients table first (CASCADE to remove remaining dependencies)
DROP TABLE IF EXISTS public.managed_clients CASCADE;

-- Drop foreign key constraints that reference managed_clients
ALTER TABLE public.client_enrollments DROP CONSTRAINT IF EXISTS client_enrollments_managed_client_id_fkey;

-- Drop the managed_client_id column from client_enrollments
ALTER TABLE public.client_enrollments DROP COLUMN IF EXISTS managed_client_id;

-- Recreate the staff_enrollments view without managed_client_id
CREATE OR REPLACE VIEW public.staff_enrollments AS
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
WHERE has_role(auth.uid(), 'admin'::app_role) 
   OR staff_has_client_relationship(auth.uid(), client_user_id) 
   OR client_user_id = auth.uid();