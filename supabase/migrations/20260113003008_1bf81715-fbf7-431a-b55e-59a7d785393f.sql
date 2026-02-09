-- Add is_system flag to protect features used by the codebase
ALTER TABLE public.features
ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.features.is_system IS 'System features are used by the codebase and cannot be deleted or have their key changed';

-- Mark known system features (used in FeatureGate components)
UPDATE public.features SET is_system = true WHERE key IN (
  'goals',
  'wheel_of_life', 
  'decision_toolkit_basic',
  'decision_toolkit_advanced',
  'assessments',
  'ai_recommendations',
  'ai_insights',
  'programs',
  'groups',
  'community',
  'learning_analytics'
);