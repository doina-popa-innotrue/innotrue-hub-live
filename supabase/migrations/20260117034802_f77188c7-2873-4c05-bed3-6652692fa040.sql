-- Add credit_cost to program_tier_plans for tier-specific pricing per program
ALTER TABLE public.program_tier_plans 
ADD COLUMN IF NOT EXISTS credit_cost INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.program_tier_plans.credit_cost IS 'Credits required to enroll in this program tier (1 credit = €1)';