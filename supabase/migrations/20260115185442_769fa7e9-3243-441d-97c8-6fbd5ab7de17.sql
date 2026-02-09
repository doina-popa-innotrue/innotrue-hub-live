-- Drop the old check constraint that only allows 'draft' and 'completed'
ALTER TABLE public.module_assignments DROP CONSTRAINT module_assessments_status_check;

-- Add the new check constraint that includes all workflow statuses
ALTER TABLE public.module_assignments ADD CONSTRAINT module_assignments_status_check 
  CHECK (status IN ('draft', 'submitted', 'reviewed', 'completed'));