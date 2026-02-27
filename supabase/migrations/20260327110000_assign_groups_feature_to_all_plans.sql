-- =============================================================================
-- Migration: Assign 'groups' feature to ALL plans
-- =============================================================================
-- The 'groups' feature exists in the features table and admin_notes states
-- "Available on all plans (Free→Elite)", but it was never inserted into
-- plan_features. This caused clients to see "Upgrade Plan" on the Groups page.
-- =============================================================================

-- Assign 'groups' to every active plan (Free, Base, Pro, Advanced, Elite)
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, true
FROM public.plans p
CROSS JOIN public.features f
WHERE f.key = 'groups'
ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = true;
