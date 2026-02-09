-- Add is_consumable flag to features table
ALTER TABLE public.features 
ADD COLUMN is_consumable boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.features.is_consumable IS 'If true, this feature has usage limits that are consumed per use (e.g., AI credits, mocks)';
COMMENT ON COLUMN public.plan_features.limit_value IS 'Monthly usage limit for consumable features. NULL means unlimited.';