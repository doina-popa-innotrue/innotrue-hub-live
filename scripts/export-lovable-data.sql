-- ============================================================================
-- export-lovable-data.sql — Export config data from Lovable's Supabase
-- ============================================================================
--
-- HOW TO USE:
--   1. Open your Lovable project's Supabase Dashboard → SQL Editor
--   2. Run the queries below for the tables you need
--   3. Copy the JSON output
--   4. Paste to Claude Code with: "Generate idempotent INSERT SQL from this
--      JSON export for [table name]"
--   5. Review the generated SQL, then run it on preprod/prod
--
-- SAFE TO EXPORT: Configuration, content, templates
-- NEVER EXPORT:   User accounts, sessions, credit balances, bookings,
--                  OAuth tokens, audit logs, notification preferences
-- ============================================================================


-- ============================================================================
-- 1. PLATFORM SETTINGS
-- ============================================================================
SELECT json_agg(row_to_json(t))
FROM (
  SELECT key, value, description
  FROM public.system_settings
  ORDER BY key
) t;


-- ============================================================================
-- 2. PLANS & PRICING
-- ============================================================================

-- 2a. Plans
SELECT json_agg(row_to_json(t))
FROM (
  SELECT key, name, description, tier_level, is_free, credit_allowance,
         monthly_price, annual_price, is_purchasable, features_description
  FROM public.plans
  ORDER BY tier_level, key
) t;

-- 2b. Features
SELECT json_agg(row_to_json(t))
FROM (
  SELECT key, name, description, is_consumable, is_system, category
  FROM public.features
  ORDER BY key
) t;

-- 2c. Plan-feature mappings
SELECT json_agg(row_to_json(t))
FROM (
  SELECT p.key AS plan_key, f.key AS feature_key, pf.limit_value
  FROM public.plan_features pf
  JOIN public.plans p ON p.id = pf.plan_id
  JOIN public.features f ON f.id = pf.feature_id
  ORDER BY p.tier_level, f.key
) t;


-- ============================================================================
-- 3. PROGRAMS & MODULES
-- ============================================================================

-- 3a. Programs
SELECT json_agg(row_to_json(t))
FROM (
  SELECT slug, name, description, category, is_active, credit_cost,
         min_plan_tier, duration_weeks, max_participants,
         features_description, image_url
  FROM public.programs
  ORDER BY slug
) t;

-- 3b. Program modules (with program slug for FK resolution)
SELECT json_agg(row_to_json(t))
FROM (
  SELECT p.slug AS program_slug, pm.title, pm.description,
         pm.module_type, pm.sort_order, pm.duration_minutes,
         pm.is_required, pm.content
  FROM public.program_modules pm
  JOIN public.programs p ON p.id = pm.program_id
  ORDER BY p.slug, pm.sort_order
) t;


-- ============================================================================
-- 4. TRACKS & TRACK FEATURES
-- ============================================================================

-- 4a. Tracks
SELECT json_agg(row_to_json(t))
FROM (
  SELECT slug, name, description, is_active, sort_order, icon, color
  FROM public.tracks
  ORDER BY sort_order
) t;

-- 4b. Track features
SELECT json_agg(row_to_json(t))
FROM (
  SELECT t.slug AS track_slug, f.key AS feature_key, tf.limit_value
  FROM public.track_features tf
  JOIN public.tracks t ON t.id = tf.track_id
  JOIN public.features f ON f.id = tf.feature_id
  ORDER BY t.slug, f.key
) t;


-- ============================================================================
-- 5. SESSION TYPES & ROLES
-- ============================================================================

-- 5a. Session types
SELECT json_agg(row_to_json(t))
FROM (
  SELECT key, name, description, duration_minutes, credit_cost,
         is_active, requires_coach, max_participants
  FROM public.session_types
  ORDER BY key
) t;

-- 5b. Session type roles
SELECT json_agg(row_to_json(t))
FROM (
  SELECT st.key AS session_type_key, str.role_name, str.description,
         str.is_required, str.max_count
  FROM public.session_type_roles str
  JOIN public.session_types st ON st.id = str.session_type_id
  ORDER BY st.key, str.role_name
) t;


-- ============================================================================
-- 6. CREDIT SYSTEM
-- ============================================================================

-- 6a. Credit services
SELECT json_agg(row_to_json(t))
FROM (
  SELECT key, name, description, credit_cost, is_active, category
  FROM public.credit_services
  ORDER BY key
) t;

-- 6b. Individual top-up packages
SELECT json_agg(row_to_json(t))
FROM (
  SELECT name, credits, price, description, is_active, sort_order
  FROM public.credit_topup_packages
  ORDER BY sort_order
) t;

-- 6c. Organization credit packages
SELECT json_agg(row_to_json(t))
FROM (
  SELECT name, credits, price, description, is_active, sort_order
  FROM public.org_credit_packages
  ORDER BY sort_order
) t;

-- 6d. Organization platform tiers
SELECT json_agg(row_to_json(t))
FROM (
  SELECT key, name, description, monthly_price, annual_price,
         included_seats, credit_allowance, is_active
  FROM public.org_platform_tiers
  ORDER BY key
) t;


-- ============================================================================
-- 7. NOTIFICATIONS
-- ============================================================================

-- 7a. Notification categories
SELECT json_agg(row_to_json(t))
FROM (
  SELECT key, name, description, sort_order
  FROM public.notification_categories
  ORDER BY sort_order
) t;

-- 7b. Notification types
SELECT json_agg(row_to_json(t))
FROM (
  SELECT nc.key AS category_key, nt.key, nt.name, nt.description,
         nt.default_email, nt.default_in_app, nt.default_push
  FROM public.notification_types nt
  JOIN public.notification_categories nc ON nc.id = nt.category_id
  ORDER BY nc.sort_order, nt.key
) t;


-- ============================================================================
-- 8. ASSESSMENTS
-- ============================================================================

-- 8a. Assessment categories
SELECT json_agg(row_to_json(t))
FROM (
  SELECT slug, name, description, sort_order, icon, color, is_active
  FROM public.assessment_categories
  ORDER BY sort_order
) t;

-- 8b. Assessment families (full assessments)
SELECT json_agg(row_to_json(t))
FROM (
  SELECT ac.slug AS category_slug, af.slug, af.name, af.description,
         af.version, af.is_active
  FROM public.assessment_families af
  JOIN public.assessment_categories ac ON ac.id = af.category_id
  ORDER BY ac.sort_order, af.slug
) t;

-- 8c. Assessment domains
SELECT json_agg(row_to_json(t))
FROM (
  SELECT af.slug AS family_slug, ad.slug, ad.name, ad.description,
         ad.sort_order
  FROM public.assessment_domains ad
  JOIN public.assessment_families af ON af.id = ad.family_id
  ORDER BY af.slug, ad.sort_order
) t;

-- 8d. Assessment questions
SELECT json_agg(row_to_json(t))
FROM (
  SELECT af.slug AS family_slug, ad.slug AS domain_slug,
         aq.text, aq.sort_order, aq.is_reverse_scored
  FROM public.assessment_questions aq
  JOIN public.assessment_domains ad ON ad.id = aq.domain_id
  JOIN public.assessment_families af ON af.id = ad.family_id
  ORDER BY af.slug, ad.sort_order, aq.sort_order
) t;


-- ============================================================================
-- 9. WHEEL OF LIFE
-- ============================================================================
SELECT json_agg(row_to_json(t))
FROM (
  SELECT slug, name, description, color, icon, sort_order
  FROM public.wheel_categories
  ORDER BY sort_order
) t;


-- ============================================================================
-- 10. MODULE TYPES
-- ============================================================================
SELECT json_agg(row_to_json(t))
FROM (
  SELECT key, name, description, icon, sort_order
  FROM public.module_types
  ORDER BY sort_order
) t;


-- ============================================================================
-- 11. PLATFORM TERMS
-- ============================================================================
SELECT json_agg(row_to_json(t))
FROM (
  SELECT version, title, content, is_current, is_blocking_on_update,
         effective_date
  FROM public.platform_terms
  ORDER BY version
) t;


-- ============================================================================
-- 12. EMAIL TEMPLATES
-- ============================================================================
SELECT json_agg(row_to_json(t))
FROM (
  SELECT key, name, subject, html_body, text_body, variables, is_active
  FROM public.email_templates
  ORDER BY key
) t;


-- ============================================================================
-- TABLES YOU SHOULD NEVER EXPORT (user/runtime data)
-- ============================================================================
-- auth.users                    — User accounts
-- public.profiles               — User profiles
-- public.user_roles             — Role assignments
-- public.client_enrollments     — Enrollment records
-- public.module_progress        — Learning progress
-- public.user_credit_balances   — Credit balances
-- public.org_credit_balances    — Org credit balances
-- public.client_coaches         — Coach assignments
-- public.sessions               — Session bookings
-- public.notifications          — User notifications
-- public.user_notification_preferences — Notification prefs
-- public.oauth_tokens           — OAuth tokens
-- public.audit_log              — Audit trail
-- public.assessment_snapshots   — User assessment results
-- public.assessment_ratings     — Individual ratings
