-- =============================================================================
-- Migration: Data Consistency Remediation
-- =============================================================================
-- Comprehensive audit revealed that many features, plans, credit services,
-- and plan-feature mappings exist ONLY in seed.sql and were never INSERT'd
-- by any migration. All subsequent migrations that referenced them via UPDATE
-- or INSERT...SELECT...WHERE silently matched 0 rows in production.
--
-- This migration ensures all critical reference data exists.
-- All statements use ON CONFLICT for idempotency (safe to run on any env).
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1: MISSING FEATURES
-- ═══════════════════════════════════════════════════════════════════════════════
-- 10 features were only in seed.sql, never in any migration.
-- Frontend FeatureGate checks for some of these (goals, ai_insights,
-- ai_recommendations, programs) would silently fail or show "Upgrade Plan".

-- AI features (non-consumable — gating toggles)
INSERT INTO public.features (key, name, description)
VALUES
  ('ai_insights', 'AI Insights', 'Generate AI-powered insights for decisions and progress'),
  ('ai_recommendations', 'AI Recommendations', 'AI-powered recommendations for goals and decisions')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Goals feature (consumable — used for credit billing)
INSERT INTO public.features (key, name, description, is_consumable)
VALUES ('goals', 'Goals', 'Create and track personal and professional goals', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_consumable = true;

-- Programs gating feature (non-consumable — gates sidebar)
INSERT INTO public.features (key, name, description)
VALUES ('programs', 'Programs', 'Access to program enrollments and content')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Program tier features (consumable — used for credit billing)
INSERT INTO public.features (key, name, description, is_consumable)
VALUES
  ('programs_base', 'Base Programs', 'Access to base-tier program enrollments', true),
  ('programs_pro', 'Pro Programs', 'Access to pro-tier program enrollments', true),
  ('programs_advanced', 'Advanced Programs', 'Access to advanced-tier program enrollments', true),
  ('courses_free', 'Micro-learning Courses', 'Access to micro-learning and short programs', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_consumable = true;

-- Specialty features (consumable — used for credit billing)
INSERT INTO public.features (key, name, description, is_consumable)
VALUES
  ('sf_cta_rbm_full_asynch', 'SF CTA Review Board Mock (Async)', 'Salesforce CTA Review Board Mock - Asynchronous', true),
  ('sf_cta_rbm_full_live', 'SF CTA Review Board Mock (Live)', 'Salesforce CTA Review Board Mock - Live', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_consumable = true;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 2: MARK ALL SYSTEM FEATURES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migrations 20260113003008 and 20260211200000 tried this but matched 0 rows
-- for features that didn't exist yet. Now all features exist, so we re-assert.

UPDATE public.features SET is_system = true WHERE key IN (
  'decision_toolkit_basic', 'decision_toolkit_advanced',
  'ai_coach', 'ai_insights', 'ai_recommendations',
  'coach_dashboard', 'org_analytics',
  'goals', 'groups', 'wheel_of_life', 'community',
  'assessments', 'learning_analytics', 'programs',
  'credits', 'skills_map', 'services', 'usage',
  'guided_paths', 'external_courses',
  'tasks', 'development_items', 'development_timeline',
  'resource_library', 'feedback_reviews', 'development_profile',
  'export_reports', 'certificates'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 3: SET ADMIN NOTES FOR PREVIOUSLY-MISSING FEATURES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 20260324120000 tried to set admin_notes but matched 0 rows for these.

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates AI Insights page (DecisionInsights) and WeeklyReflectionCard on dashboard. Available from Base plan. Consumable — costs 2 credits per insight.'
WHERE key = 'ai_insights';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Course Recommendations page. Available from Advanced plan. AI-powered learning path and course suggestions.'
WHERE key = 'ai_recommendations';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Goals page via FeatureGate and DevelopmentTimeline goal section. Available on all plans (Free→Elite). Consumable — costs 4 credits per goal creation.'
WHERE key = 'goals';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Programs section in sidebar and program enrollment pages. Available on all plans (Free→Elite) but program-tier features control which programs are accessible.'
WHERE key = 'programs';

UPDATE public.features SET admin_notes =
  'Consumable. Enrollment in base-tier programs. Available from Pro plan. Costs 500 credits.'
WHERE key = 'programs_base';

UPDATE public.features SET admin_notes =
  'Consumable. Enrollment in pro-tier programs. Available from Advanced plan. Costs 2000 credits.'
WHERE key = 'programs_pro';

UPDATE public.features SET admin_notes =
  'Consumable. Enrollment in advanced-tier programs. Available from Elite plan. Costs 6000 credits.'
WHERE key = 'programs_advanced';

UPDATE public.features SET admin_notes =
  'Consumable. Micro-learning and short programs. Available from Base plan. Costs 100 credits.'
WHERE key = 'courses_free';

UPDATE public.features SET admin_notes =
  'Consumable. Salesforce CTA Review Board Mock — Asynchronous. Available on Elite plan. Costs 300 credits.'
WHERE key = 'sf_cta_rbm_full_asynch';

UPDATE public.features SET admin_notes =
  'Consumable. Salesforce CTA Review Board Mock — Live. Available on Elite plan. Costs 1500 credits.'
WHERE key = 'sf_cta_rbm_full_live';


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 4: MISSING PLANS (Base, Advanced, Elite)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Only free, pro, enterprise, programs, continuation exist from migrations.
-- The 5-tier structure (Free, Base, Pro, Advanced, Elite) requires these 3.

INSERT INTO public.plans (key, name, description, is_active, is_free, tier_level, credit_allowance, is_purchasable, display_name)
VALUES
  ('base', 'Base', 'Essential tools for structured personal development', true, false, 1, 100, true, 'Base'),
  ('advanced', 'Advanced', 'Comprehensive toolkit with advanced coaching and analytics', true, false, 3, 360, true, 'Advanced'),
  ('elite', 'Elite', 'Full platform access with premium features and priority support', true, false, 4, 500, true, 'Elite')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_free = EXCLUDED.is_free,
  tier_level = EXCLUDED.tier_level,
  credit_allowance = EXCLUDED.credit_allowance,
  is_purchasable = EXCLUDED.is_purchasable,
  display_name = CASE
    WHEN plans.display_name IS NULL OR plans.display_name = 'plan'
    THEN EXCLUDED.display_name
    ELSE plans.display_name  -- preserve custom display_name if already set
  END;

-- Plan prices (missing for base, advanced, elite)
INSERT INTO public.plan_prices (plan_id, billing_interval, price_cents, is_default)
VALUES
  ((SELECT id FROM plans WHERE key = 'base'), 'month', 4900, true),
  ((SELECT id FROM plans WHERE key = 'pro'), 'month', 9900, true),
  ((SELECT id FROM plans WHERE key = 'advanced'), 'month', 14900, true),
  ((SELECT id FROM plans WHERE key = 'elite'), 'month', 29900, true)
ON CONFLICT (plan_id, billing_interval) DO NOTHING;

-- Annual prices
INSERT INTO public.plan_prices (plan_id, billing_interval, price_cents, is_default)
VALUES
  ((SELECT id FROM plans WHERE key = 'base'), 'year', 47000, false),
  ((SELECT id FROM plans WHERE key = 'pro'), 'year', 95000, false),
  ((SELECT id FROM plans WHERE key = 'advanced'), 'year', 143000, false),
  ((SELECT id FROM plans WHERE key = 'elite'), 'year', 287000, false)
ON CONFLICT (plan_id, billing_interval) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 5: MISSING CREDIT SERVICES (9 of 14)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 20260117021920 silently created only 5 session-based services.
-- The 9 below require features that didn't exist at the time.

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'AI Insight', 'Generate an AI insight for decisions', 2, 'ai', id, true
FROM features WHERE key = 'ai_insights'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'AI Recommendation', 'Generate an AI recommendation', 2, 'ai', id, true
FROM features WHERE key = 'ai_recommendations'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Goal Creation', 'Create a new goal', 4, 'goals', id, true
FROM features WHERE key = 'goals'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Base Program Enrollment', 'Enroll in a base program', 500, 'programs', id, true
FROM features WHERE key = 'programs_base'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Pro Program Enrollment', 'Enroll in a pro program', 2000, 'programs', id, true
FROM features WHERE key = 'programs_pro'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Advanced Program Enrollment', 'Enroll in an advanced program', 6000, 'programs', id, true
FROM features WHERE key = 'programs_advanced'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Micro-learning Course', 'Access a micro-learning or short program', 100, 'programs', id, true
FROM features WHERE key = 'courses_free'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'SF CTA Review Board Mock (Async)', 'Salesforce CTA Review Board Mock - Asynchronous', 300, 'specialty', id, true
FROM features WHERE key = 'sf_cta_rbm_full_asynch'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'SF CTA Review Board Mock (Live)', 'Salesforce CTA Review Board Mock - Live', 1500, 'specialty', id, true
FROM features WHERE key = 'sf_cta_rbm_full_live'
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 6: PLAN-FEATURES MAPPINGS
-- ═══════════════════════════════════════════════════════════════════════════════
-- Re-run the full plan_features matrix from seed.sql.
-- This covers features and plans that didn't exist when earlier migrations ran.

-- Universal features available on ALL plans (including Free)
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, true
FROM public.plans p
CROSS JOIN public.features f
WHERE f.key IN ('goals', 'programs', 'groups', 'tasks', 'development_items',
                'development_timeline', 'wheel_of_life', 'credits', 'usage')
ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = true;

-- Free plan: basic features with limits
INSERT INTO public.plan_features (plan_id, feature_id, enabled, limit_value)
SELECT p.id, f.id, true,
  CASE
    WHEN f.key = 'ai_coach' THEN 20
    WHEN f.key = 'ai_insights' THEN 5
    WHEN f.key = 'session_coaching' THEN 1
    ELSE NULL
  END
FROM public.plans p, public.features f
WHERE p.key = 'free'
  AND f.key IN ('decision_toolkit_basic', 'ai_coach', 'ai_insights', 'session_coaching')
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = true,
  limit_value = EXCLUDED.limit_value;

-- Base plan features
INSERT INTO public.plan_features (plan_id, feature_id, enabled, limit_value)
SELECT p.id, f.id, true,
  CASE
    WHEN f.key = 'ai_coach' THEN 50
    WHEN f.key = 'ai_insights' THEN 50
    WHEN f.key = 'session_coaching' THEN 3
    ELSE NULL
  END
FROM public.plans p, public.features f
WHERE p.key = 'base'
  AND f.key IN ('decision_toolkit_basic', 'ai_coach', 'ai_insights',
                'session_coaching', 'session_group', 'courses_free',
                'services', 'skills_map', 'assessments',
                'resource_library', 'feedback_reviews', 'export_reports')
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = true,
  limit_value = EXCLUDED.limit_value;

-- Pro plan features
INSERT INTO public.plan_features (plan_id, feature_id, enabled, limit_value)
SELECT p.id, f.id, true,
  CASE
    WHEN f.key = 'ai_coach' THEN 200
    WHEN f.key = 'ai_insights' THEN 100
    WHEN f.key = 'session_coaching' THEN 5
    ELSE NULL
  END
FROM public.plans p, public.features f
WHERE p.key = 'pro'
  AND f.key IN ('decision_toolkit_advanced', 'ai_coach', 'ai_insights',
                'coach_dashboard', 'session_coaching', 'session_group',
                'session_workshop', 'session_peer_coaching',
                'programs_base', 'courses_free',
                'services', 'skills_map', 'guided_paths', 'external_courses',
                'learning_analytics', 'assessments',
                'resource_library', 'feedback_reviews', 'export_reports',
                'development_profile', 'certificates')
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = true,
  limit_value = EXCLUDED.limit_value;

-- Advanced plan features
INSERT INTO public.plan_features (plan_id, feature_id, enabled, limit_value)
SELECT p.id, f.id, true,
  CASE
    WHEN f.key = 'ai_coach' THEN 500
    WHEN f.key = 'ai_insights' THEN 200
    WHEN f.key = 'session_coaching' THEN 10
    ELSE NULL
  END
FROM public.plans p, public.features f
WHERE p.key = 'advanced'
  AND f.key IN ('decision_toolkit_advanced', 'ai_coach', 'ai_insights',
                'ai_recommendations', 'coach_dashboard',
                'session_coaching', 'session_group', 'session_workshop',
                'session_peer_coaching', 'session_review_board',
                'programs_base', 'programs_pro', 'courses_free',
                'services', 'skills_map', 'guided_paths', 'external_courses',
                'community', 'learning_analytics', 'assessments',
                'resource_library', 'feedback_reviews', 'export_reports',
                'development_profile', 'certificates')
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = true,
  limit_value = EXCLUDED.limit_value;

-- Elite plan features (everything)
INSERT INTO public.plan_features (plan_id, feature_id, enabled, limit_value)
SELECT p.id, f.id, true,
  CASE
    WHEN f.key = 'ai_coach' THEN 1000
    WHEN f.key = 'ai_insights' THEN 300
    WHEN f.key = 'session_coaching' THEN 20
    ELSE NULL
  END
FROM public.plans p, public.features f
WHERE p.key = 'elite'
  AND f.key IN ('decision_toolkit_advanced', 'ai_coach', 'ai_insights',
                'ai_recommendations', 'coach_dashboard', 'org_analytics',
                'session_coaching', 'session_group', 'session_workshop',
                'session_peer_coaching', 'session_review_board',
                'programs_base', 'programs_pro', 'programs_advanced', 'courses_free',
                'sf_cta_rbm_full_asynch', 'sf_cta_rbm_full_live',
                'services', 'skills_map', 'guided_paths', 'external_courses',
                'community', 'learning_analytics', 'assessments',
                'resource_library', 'feedback_reviews', 'export_reports',
                'development_profile', 'certificates')
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = true,
  limit_value = EXCLUDED.limit_value;

-- Also ensure all track_features have groups (already done in 20260327120000,
-- but re-assert for any tracks created after that migration)
INSERT INTO public.track_features (track_id, feature_id, is_enabled)
SELECT t.id, f.id, true
FROM public.tracks t
CROSS JOIN public.features f
WHERE f.key = 'groups'
ON CONFLICT (track_id, feature_id) DO UPDATE SET is_enabled = true;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 7: FIX ADD-ON FEATURE LINKS
-- ═══════════════════════════════════════════════════════════════════════════════
-- ai_power_pack → ai_insights, ai_recommendations (both were missing)
-- community_access → groups (was missing when 20260324140000 ran)

INSERT INTO public.add_on_features (add_on_id, feature_id)
SELECT a.id, f.id
FROM public.add_ons a, public.features f
WHERE (a.key = 'ai_power_pack' AND f.key IN ('ai_insights', 'ai_recommendations'))
   OR (a.key = 'community_access' AND f.key IN ('community', 'groups'))
ON CONFLICT (add_on_id, feature_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 8: PLAN CREDIT ALLOCATIONS
-- ═══════════════════════════════════════════════════════════════════════════════
-- Populate from plan_features where limit_value is set (same as seed.sql).

INSERT INTO plan_credit_allocations (plan_id, feature_key, monthly_allocation)
SELECT
  pf.plan_id,
  f.key,
  pf.limit_value
FROM plan_features pf
JOIN features f ON pf.feature_id = f.id
WHERE pf.limit_value IS NOT NULL
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
  monthly_allocation = EXCLUDED.monthly_allocation,
  updated_at = now();


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 9: FIX NOTIFICATION CATEGORY (learning)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 20260203142352 references notification_categories WHERE key = 'learning'
-- but that category was never created. Create it now, then fix the notification type.

INSERT INTO public.notification_categories (key, name, description, icon, order_index)
VALUES ('learning', 'Learning & Content', 'Content updates, course progress, and learning milestones', 'book-open', 9)
ON CONFLICT (key) DO NOTHING;

-- Fix the content_updated notification type that had NULL category_id
UPDATE public.notification_types
SET category_id = (SELECT id FROM notification_categories WHERE key = 'learning')
WHERE key = 'content_updated'
  AND category_id IS NULL;
