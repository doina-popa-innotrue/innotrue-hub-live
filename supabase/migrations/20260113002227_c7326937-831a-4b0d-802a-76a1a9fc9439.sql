-- Add snapshot fields to preserve historical question/domain text
ALTER TABLE public.capability_snapshot_ratings
ADD COLUMN IF NOT EXISTS question_text_snapshot TEXT,
ADD COLUMN IF NOT EXISTS domain_name_snapshot TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.capability_snapshot_ratings.question_text_snapshot IS 'Frozen question text at time of completion - protects against future edits';
COMMENT ON COLUMN public.capability_snapshot_ratings.domain_name_snapshot IS 'Frozen domain name at time of completion - protects against future edits';