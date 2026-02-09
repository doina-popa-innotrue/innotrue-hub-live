-- Add pass/fail configuration fields to capability_assessments
ALTER TABLE public.capability_assessments
ADD COLUMN pass_fail_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN pass_fail_mode text CHECK (pass_fail_mode IN ('overall', 'per_domain')),
ADD COLUMN pass_fail_threshold integer CHECK (pass_fail_threshold >= 0 AND pass_fail_threshold <= 100);

-- Add comment for clarity
COMMENT ON COLUMN public.capability_assessments.pass_fail_enabled IS 'Whether Pass/Needs Improvement determination is enabled for this assessment';
COMMENT ON COLUMN public.capability_assessments.pass_fail_mode IS 'How to determine pass/fail: overall (overall score) or per_domain (any domain below threshold)';
COMMENT ON COLUMN public.capability_assessments.pass_fail_threshold IS 'Percentage threshold (0-100) below which is considered Needs Improvement';