-- Add is_retired column to capability_assessments
-- Retired assessments are not available for new use but existing snapshots remain viewable
ALTER TABLE public.capability_assessments 
ADD COLUMN is_retired BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the distinction
COMMENT ON COLUMN public.capability_assessments.is_retired IS 'Retired assessments cannot be used for new snapshots but existing data remains accessible';