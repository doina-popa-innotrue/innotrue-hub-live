-- =============================================================================
-- Migration: Seed default add-ons + link to features
-- =============================================================================
-- Add-ons are purchasable extras that grant features beyond a user's plan.
-- Users request add-ons via the Subscription page; admins approve and grant.
--
-- Seeded add-ons:
--   1. ai_power_pack       — AI Insights + AI Recommendations (non-consumable)
--   2. coaching_sessions_5  — 5 extra coaching sessions (consumable)
--   3. group_sessions_3     — 3 extra group sessions (consumable)
--   4. advanced_analytics   — Org Analytics + Learning Analytics (non-consumable)
--   5. community_access     — Community + Groups access (non-consumable)
--   6. export_reports_addon — PDF/report export capability (non-consumable)
-- =============================================================================

-- 1. Insert add-ons
INSERT INTO public.add_ons (key, name, display_name, description, price_cents, is_consumable, initial_quantity, is_active) VALUES
  ('ai_power_pack',       'AI Power Pack',        'AI Power Pack',
   'Unlock AI-powered insights and recommendations for your goals, decisions, and progress.',
   2900, false, NULL, true),
  ('coaching_sessions_5', 'Coaching Session Pack', 'Coaching Session Pack (5)',
   'Five additional one-on-one coaching sessions with certified coaches.',
   14900, true, 5, true),
  ('group_sessions_3',    'Group Session Pack',    'Group Session Pack (3)',
   'Three group coaching or mastermind sessions to learn with peers.',
   7900, true, 3, true),
  ('advanced_analytics',  'Advanced Analytics',    'Advanced Analytics',
   'Enterprise-level analytics and learning progress insights for deeper visibility into your development.',
   4900, false, NULL, true),
  ('community_access',    'Community & Groups',    'Community & Groups',
   'Access to community discussions, peer groups, and collaboration features.',
   1900, false, NULL, true),
  ('export_reports_addon','Export & Reports',       'Export & Reports',
   'Export your data as PDF reports and downloadable summaries.',
   990, false, NULL, true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  is_consumable = EXCLUDED.is_consumable,
  initial_quantity = EXCLUDED.initial_quantity;

-- 2. Link add-ons to features via add_on_features
-- AI Power Pack → ai_insights, ai_recommendations
INSERT INTO public.add_on_features (add_on_id, feature_id)
SELECT a.id, f.id
FROM public.add_ons a, public.features f
WHERE a.key = 'ai_power_pack' AND f.key IN ('ai_insights', 'ai_recommendations')
ON CONFLICT (add_on_id, feature_id) DO NOTHING;

-- Coaching Session Pack → session_coaching
INSERT INTO public.add_on_features (add_on_id, feature_id)
SELECT a.id, f.id
FROM public.add_ons a, public.features f
WHERE a.key = 'coaching_sessions_5' AND f.key = 'session_coaching'
ON CONFLICT (add_on_id, feature_id) DO NOTHING;

-- Group Session Pack → session_group
INSERT INTO public.add_on_features (add_on_id, feature_id)
SELECT a.id, f.id
FROM public.add_ons a, public.features f
WHERE a.key = 'group_sessions_3' AND f.key = 'session_group'
ON CONFLICT (add_on_id, feature_id) DO NOTHING;

-- Advanced Analytics → org_analytics, learning_analytics
INSERT INTO public.add_on_features (add_on_id, feature_id)
SELECT a.id, f.id
FROM public.add_ons a, public.features f
WHERE a.key = 'advanced_analytics' AND f.key IN ('org_analytics', 'learning_analytics')
ON CONFLICT (add_on_id, feature_id) DO NOTHING;

-- Community & Groups → community, groups
INSERT INTO public.add_on_features (add_on_id, feature_id)
SELECT a.id, f.id
FROM public.add_ons a, public.features f
WHERE a.key = 'community_access' AND f.key IN ('community', 'groups')
ON CONFLICT (add_on_id, feature_id) DO NOTHING;

-- Export & Reports → export_reports
INSERT INTO public.add_on_features (add_on_id, feature_id)
SELECT a.id, f.id
FROM public.add_ons a, public.features f
WHERE a.key = 'export_reports_addon' AND f.key = 'export_reports'
ON CONFLICT (add_on_id, feature_id) DO NOTHING;
