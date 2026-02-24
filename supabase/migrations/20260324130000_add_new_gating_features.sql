-- =============================================================================
-- Migration: Add 5 new gating features + plan_features mappings
-- =============================================================================
-- New features:
--   1. resource_library  — Gates My Resources page (Base+)
--   2. feedback_reviews  — Gates My Feedback page (Base+)
--   3. development_profile — Gates Development Profile page (Pro+)
--   4. export_reports    — Gates PDF/report export functionality (Base+)
--   5. certificates      — Pre-created for upcoming 2B.5 Certification (Pro+)
-- =============================================================================

-- 1. Insert new features
INSERT INTO public.features (key, name, description, is_system, admin_notes) VALUES
  ('resource_library', 'Resource Library', 'Access to unified resource discovery and downloads',
    true, 'SYSTEM. Gates My Resources page and sidebar item. Available from Base plan. Aggregates resources from 8+ sources (goals, tasks, modules, coach feedback, shared library). Credit-based access on shared library items is separate.'),
  ('feedback_reviews', 'Feedback Reviews', 'View feedback from coaches and instructors',
    true, 'SYSTEM. Gates My Feedback page and sidebar item. Available from Base plan. Shows scenario, module, assignment, and goal feedback from coaches/instructors.'),
  ('development_profile', 'Development Profile', 'Unified view of strengths, gaps, and development progress',
    true, 'SYSTEM. Gates Development Profile page. Available from Pro plan. Synthesizes data from assessments, psychometrics, skills, guided paths, and readiness into a single dashboard.'),
  ('export_reports', 'Export Reports', 'Export data as PDF reports and calendar files',
    true, 'SYSTEM. Gates PDF export and advanced report generation. Available from Base plan. Does NOT affect GDPR data export (that is always available). ICS calendar exports for enrolled sessions remain ungated.'),
  ('certificates', 'Certificates', 'View and download earned certificates',
    true, 'SYSTEM. Pre-created for 2B.5 Certification feature (not yet built). Will gate certificate viewing/downloading. Available from Pro plan when implemented.')
ON CONFLICT (key) DO UPDATE SET
  is_system = EXCLUDED.is_system,
  admin_notes = EXCLUDED.admin_notes;

-- 2. Map new features to plans
-- resource_library: Base+ (not Free)
-- feedback_reviews: Base+ (not Free)
-- export_reports: Base+ (not Free)
-- development_profile: Pro+ (not Free, not Base)
-- certificates: Pro+ (not Free, not Base)

WITH plan_ids AS (
  SELECT id, key FROM public.plans WHERE key IN ('base', 'pro', 'advanced', 'elite')
),
feature_ids AS (
  SELECT id, key FROM public.features WHERE key IN ('resource_library', 'feedback_reviews', 'export_reports')
)
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, true
FROM plan_ids p
CROSS JOIN feature_ids f
ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = true;

-- development_profile + certificates: Pro+ only
WITH plan_ids AS (
  SELECT id, key FROM public.plans WHERE key IN ('pro', 'advanced', 'elite')
),
feature_ids AS (
  SELECT id, key FROM public.features WHERE key IN ('development_profile', 'certificates')
)
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, true
FROM plan_ids p
CROSS JOIN feature_ids f
ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = true;
