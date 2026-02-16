-- H10: Add is_restrictive flag to plan_features
-- When true, this feature is explicitly DENIED for the plan,
-- overriding any grants from other sources (subscription, add-on, track, etc.)
-- Primary use case: org-sponsored plans that need to block certain features.

ALTER TABLE public.plan_features
ADD COLUMN IF NOT EXISTS is_restrictive BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.plan_features.is_restrictive IS
  'When true, this entry explicitly DENIES the feature, overriding grants from all other sources. Used by org-sponsored plans to block features.';
