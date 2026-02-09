-- Add feature_key column to psychometric_assessments table
-- This links each assessment to a feature key for plan-based gating
ALTER TABLE public.psychometric_assessments
ADD COLUMN feature_key TEXT NULL;

-- Add index for faster lookups
CREATE INDEX idx_psychometric_assessments_feature_key ON public.psychometric_assessments(feature_key);