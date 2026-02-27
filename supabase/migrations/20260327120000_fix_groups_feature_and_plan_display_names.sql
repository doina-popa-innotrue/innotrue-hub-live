-- =============================================================================
-- Migration: Fix groups feature + plan display names
-- =============================================================================
-- Two bugs:
-- 1. The 'groups' feature was never INSERT'd in any migration (only in seed.sql).
--    All subsequent migrations (is_system, admin_notes, plan_features) silently
--    matched 0 rows. Clients see "Upgrade Plan" on the Groups page.
-- 2. display_name column was added to plans with DEFAULT 'plan', so all plans
--    show "plan" in the UI header instead of their actual name.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Insert the 'groups' feature (gating feature for Peer Groups page)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.features (key, name, description, is_system)
VALUES ('groups', 'Groups', 'Peer groups and collaboration features', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  is_system = true;

-- Set admin_notes (originally attempted by 20260324120000 which matched 0 rows)
UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Peer Groups page via FeatureGate. Available on all plans (Free→Elite). Group collaboration features.'
WHERE key = 'groups';

-- Assign 'groups' to every active plan (originally attempted by 20260327110000)
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, true
FROM public.plans p
CROSS JOIN public.features f
WHERE f.key = 'groups'
ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = true;

-- Also assign to all tracks (so track-based access works too)
INSERT INTO public.track_features (track_id, feature_id, is_enabled)
SELECT t.id, f.id, true
FROM public.tracks t
CROSS JOIN public.features f
WHERE f.key = 'groups'
ON CONFLICT (track_id, feature_id) DO UPDATE SET is_enabled = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Populate plan display_name from actual plan name
-- ─────────────────────────────────────────────────────────────────────────────
-- The 20260123130736 migration added display_name with DEFAULT 'plan',
-- so all existing plans got display_name = 'plan' instead of their real name.
-- Use INITCAP(name) for a clean display (e.g. "base" → "Base", "pro" → "Pro").
UPDATE public.plans
SET display_name = INITCAP(name)
WHERE display_name = 'plan' OR display_name IS NULL;

-- Fix the default so future plans don't get 'plan' as display_name
ALTER TABLE public.plans ALTER COLUMN display_name SET DEFAULT NULL;
