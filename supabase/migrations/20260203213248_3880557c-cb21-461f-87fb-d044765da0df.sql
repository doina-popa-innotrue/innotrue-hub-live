-- Add assessment mode and separate instruction fields to capability_assessments
ALTER TABLE public.capability_assessments
ADD COLUMN assessment_mode text NOT NULL DEFAULT 'both' CHECK (assessment_mode IN ('self', 'evaluator', 'both')),
ADD COLUMN instructions_self text,
ADD COLUMN instructions_evaluator text;

-- Add comments for clarity
COMMENT ON COLUMN public.capability_assessments.assessment_mode IS 'Controls which modes are available: self (self-assessment only), evaluator (instructor/peer only), both';
COMMENT ON COLUMN public.capability_assessments.instructions_self IS 'Instructions shown when taking a self-assessment';
COMMENT ON COLUMN public.capability_assessments.instructions_evaluator IS 'Instructions shown when an evaluator is assessing someone else';