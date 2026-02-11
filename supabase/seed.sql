-- =============================================================================
-- InnoTrue Hub - Database Seed File
-- =============================================================================
-- This file runs AFTER all migrations during `supabase db reset`.
-- It uses the service role, so it can write to auth.users directly.
-- All INSERTs use ON CONFLICT DO NOTHING / DO UPDATE for idempotency.
-- =============================================================================

-- =============================================================================
-- SECTION 1: SYSTEM SETTINGS
-- =============================================================================

INSERT INTO public.system_settings (key, value, description) VALUES
  ('ai_monthly_credit_limit', '1000', 'Maximum AI credits allowed per month for the entire platform'),
  ('ai_alert_threshold_percent', '70', 'Percentage of AI credit limit at which to send admin alert'),
  ('ai_alert_email', 'hubadmin@innotrue.com', 'Email address to receive AI usage alerts'),
  ('ai_alert_sent_this_month', 'false', 'Flag to track if alert was already sent this month'),
  ('platform_name', 'InnoTrue Hub', 'Display name for the platform'),
  ('support_email', 'support@innotrue.com', 'Support contact email'),
  ('default_timezone', 'Europe/Amsterdam', 'Default timezone for the platform')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- =============================================================================
-- SECTION 2: PLANS & TIERS
-- =============================================================================

-- The initial migration creates Free, Pro, Enterprise.
-- Later migrations add is_free, tier_level, credit_allowance, is_purchasable.
-- The final plan lineup after all migrations is:
-- Free (tier 0), Base (tier 1), Pro (tier 2), Advanced (tier 3), Elite (tier 4)
-- Plus non-purchasable: Programs (tier 0), Continuation (tier 0)

-- Update existing plans from migrations to have correct tier data
UPDATE public.plans SET is_free = true, tier_level = 0, credit_allowance = 20
  WHERE key = 'free';
UPDATE public.plans SET tier_level = 2, credit_allowance = 250
  WHERE key = 'pro';

-- Rename enterprise to something else or ensure Base/Advanced/Elite exist
-- Insert Base, Advanced, Elite if they don't exist yet
-- Note: price_cents and billing_interval were moved to plan_prices table
INSERT INTO public.plans (key, name, description, is_active, is_free, tier_level, credit_allowance, is_purchasable)
VALUES
  ('base', 'Base', 'Essential tools for structured personal development', true, false, 1, 150, true),
  ('advanced', 'Advanced', 'Comprehensive toolkit with advanced coaching and analytics', true, false, 3, 500, true),
  ('elite', 'Elite', 'Full platform access with premium features and priority support', true, false, 4, 750, true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_free = EXCLUDED.is_free,
  tier_level = EXCLUDED.tier_level,
  credit_allowance = EXCLUDED.credit_allowance,
  is_purchasable = EXCLUDED.is_purchasable;

-- Plan prices (pricing moved to separate table)
INSERT INTO public.plan_prices (plan_id, billing_interval, price_cents, is_default)
VALUES
  ((SELECT id FROM plans WHERE key = 'base'), 'month', 1900, true),
  ((SELECT id FROM plans WHERE key = 'pro'), 'month', 2900, true),
  ((SELECT id FROM plans WHERE key = 'advanced'), 'month', 4900, true),
  ((SELECT id FROM plans WHERE key = 'elite'), 'month', 9900, true)
ON CONFLICT (plan_id, billing_interval) DO NOTHING;

-- Programs and Continuation plans (non-purchasable)
INSERT INTO public.plans (key, name, description, is_active, is_free, tier_level, is_purchasable)
VALUES
  ('programs', 'Programs', 'For users who have purchased individual programs. Access to purchased program content without a monthly subscription.', true, true, 0, false),
  ('continuation', 'Continuation', 'Continue accessing your completed programs while deciding on your next steps. Upgrade to Pro for full platform access and new programs.', true, true, 0, false)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_free = EXCLUDED.is_free,
  tier_level = EXCLUDED.tier_level,
  is_purchasable = EXCLUDED.is_purchasable;

-- =============================================================================
-- SECTION 3: FEATURES
-- =============================================================================

-- Core features (from initial migration)
INSERT INTO public.features (key, name, description) VALUES
  ('decision_toolkit_basic', 'Basic Decision Toolkit', 'Access to basic decision-making frameworks'),
  ('decision_toolkit_advanced', 'Advanced Decision Toolkit', 'Access to all decision frameworks, analytics, and outcome tracking'),
  ('ai_coach', 'AI Coaching', 'AI-powered coaching recommendations and insights'),
  ('coach_dashboard', 'Coach Dashboard', 'Dedicated dashboard for coaches to manage clients'),
  ('org_analytics', 'Organization Analytics', 'Enterprise-level analytics and reporting')
ON CONFLICT (key) DO NOTHING;

-- AI features
INSERT INTO public.features (key, name, description) VALUES
  ('ai_insights', 'AI Insights', 'Generate AI-powered insights for decisions and progress'),
  ('ai_recommendations', 'AI Recommendations', 'AI-powered recommendations for goals and decisions')
ON CONFLICT (key) DO NOTHING;

-- Session features (consumable)
INSERT INTO public.features (key, name, description, is_consumable) VALUES
  ('session_coaching', 'Coaching Sessions', 'One-on-one coaching sessions', true),
  ('session_group', 'Group Sessions', 'Group coaching and mastermind sessions', true),
  ('session_workshop', 'Workshops', 'Workshop and training sessions', true),
  ('session_review_board', 'Review Board Sessions', 'Review board mock sessions with evaluators', true),
  ('session_peer_coaching', 'Peer Coaching', 'Peer-to-peer coaching sessions', true)
ON CONFLICT (key) DO NOTHING;

-- Program features (consumable)
INSERT INTO public.features (key, name, description, is_consumable) VALUES
  ('programs_base', 'Base Programs', 'Access to base-tier program enrollments', true),
  ('programs_pro', 'Pro Programs', 'Access to pro-tier program enrollments', true),
  ('programs_advanced', 'Advanced Programs', 'Access to advanced-tier program enrollments', true),
  ('courses_free', 'Micro-learning Courses', 'Access to micro-learning and short programs', true)
ON CONFLICT (key) DO NOTHING;

-- Specialty features (consumable)
INSERT INTO public.features (key, name, description, is_consumable) VALUES
  ('sf_cta_rbm_full_asynch', 'SF CTA Review Board Mock (Async)', 'Salesforce CTA Review Board Mock - Asynchronous', true),
  ('sf_cta_rbm_full_live', 'SF CTA Review Board Mock (Live)', 'Salesforce CTA Review Board Mock - Live', true)
ON CONFLICT (key) DO NOTHING;

-- Goals feature (consumable)
INSERT INTO public.features (key, name, description, is_consumable) VALUES
  ('goals', 'Goals', 'Create and track personal and professional goals', true)
ON CONFLICT (key) DO NOTHING;

-- Platform gating features (UI pages/sidebar items gated behind these)
INSERT INTO public.features (key, name, description) VALUES
  ('credits', 'Credits', 'View credit balance and purchase top-ups'),
  ('skills_map', 'Skills Map', 'Track acquired skills and share on profile'),
  ('services', 'Services', 'Browse available services and credit costs'),
  ('usage', 'Usage Overview', 'Track AI credits and feature consumption'),
  ('guided_paths', 'Guided Paths', 'Follow curated paths with goals and milestones'),
  ('external_courses', 'External Courses', 'Track courses from other platforms'),
  ('community', 'Community', 'Community features and discussions'),
  ('wheel_of_life', 'Wheel of Life', 'Self-assessment wheel of life tool'),
  ('assessments', 'Assessments', 'Capability assessments and evaluations'),
  ('learning_analytics', 'Learning Analytics', 'Learning progress analytics and insights'),
  ('tasks', 'Tasks', 'Task management and tracking'),
  ('development_items', 'Development Items', 'Track development items and action points'),
  ('development_timeline', 'Development Timeline', 'View development progress over time')
ON CONFLICT (key) DO NOTHING;

-- Mark system features (protected from deletion/rename in admin UI)
UPDATE public.features SET is_system = true WHERE key IN (
  'decision_toolkit_basic', 'decision_toolkit_advanced',
  'ai_insights', 'ai_recommendations',
  'goals', 'groups', 'wheel_of_life', 'community',
  'assessments', 'learning_analytics',
  'credits', 'skills_map', 'services', 'usage',
  'guided_paths', 'external_courses',
  'tasks', 'development_items', 'development_timeline'
);

-- Plan-features mappings
WITH plan_ids AS (
  SELECT id, key FROM public.plans
),
feature_ids AS (
  SELECT id, key FROM public.features
)
INSERT INTO public.plan_features (plan_id, feature_id, enabled, limit_value)
SELECT p.id, f.id, true,
  CASE
    -- AI Coach limits by plan
    WHEN p.key = 'free' AND f.key = 'ai_coach' THEN 20
    WHEN p.key = 'base' AND f.key = 'ai_coach' THEN 50
    WHEN p.key = 'pro' AND f.key = 'ai_coach' THEN 200
    WHEN p.key = 'advanced' AND f.key = 'ai_coach' THEN 500
    WHEN p.key = 'elite' AND f.key = 'ai_coach' THEN 1000
    -- AI Insights limits
    WHEN p.key = 'free' AND f.key = 'ai_insights' THEN 5
    WHEN p.key = 'base' AND f.key = 'ai_insights' THEN 50
    WHEN p.key = 'pro' AND f.key = 'ai_insights' THEN 100
    WHEN p.key = 'advanced' AND f.key = 'ai_insights' THEN 200
    WHEN p.key = 'elite' AND f.key = 'ai_insights' THEN 300
    -- Session limits
    WHEN p.key = 'free' AND f.key = 'session_coaching' THEN 1
    WHEN p.key = 'base' AND f.key = 'session_coaching' THEN 3
    WHEN p.key = 'pro' AND f.key = 'session_coaching' THEN 5
    WHEN p.key = 'advanced' AND f.key = 'session_coaching' THEN 10
    WHEN p.key = 'elite' AND f.key = 'session_coaching' THEN 20
    ELSE NULL
  END
FROM plan_ids p
CROSS JOIN feature_ids f
WHERE
  (p.key = 'free' AND f.key IN ('decision_toolkit_basic', 'ai_coach', 'ai_insights', 'session_coaching', 'goals', 'credits', 'usage', 'tasks', 'wheel_of_life', 'development_items', 'development_timeline'))
  OR (p.key = 'base' AND f.key IN ('decision_toolkit_basic', 'ai_coach', 'ai_insights', 'session_coaching', 'session_group', 'goals', 'courses_free', 'credits', 'usage', 'services', 'tasks', 'wheel_of_life', 'skills_map', 'development_items', 'development_timeline', 'assessments'))
  OR (p.key = 'pro' AND f.key IN ('decision_toolkit_advanced', 'ai_coach', 'ai_insights', 'coach_dashboard', 'session_coaching', 'session_group', 'session_workshop', 'session_peer_coaching', 'goals', 'programs_base', 'courses_free', 'credits', 'usage', 'services', 'tasks', 'wheel_of_life', 'skills_map', 'guided_paths', 'external_courses', 'learning_analytics', 'development_items', 'development_timeline', 'assessments'))
  OR (p.key = 'advanced' AND f.key IN ('decision_toolkit_advanced', 'ai_coach', 'ai_insights', 'ai_recommendations', 'coach_dashboard', 'session_coaching', 'session_group', 'session_workshop', 'session_peer_coaching', 'session_review_board', 'goals', 'programs_base', 'programs_pro', 'courses_free', 'credits', 'usage', 'services', 'tasks', 'wheel_of_life', 'skills_map', 'guided_paths', 'external_courses', 'community', 'learning_analytics', 'development_items', 'development_timeline', 'assessments'))
  OR (p.key = 'elite' AND f.key IN ('decision_toolkit_advanced', 'ai_coach', 'ai_insights', 'ai_recommendations', 'coach_dashboard', 'org_analytics', 'session_coaching', 'session_group', 'session_workshop', 'session_peer_coaching', 'session_review_board', 'goals', 'programs_base', 'programs_pro', 'programs_advanced', 'courses_free', 'sf_cta_rbm_full_asynch', 'sf_cta_rbm_full_live', 'credits', 'usage', 'services', 'tasks', 'wheel_of_life', 'skills_map', 'guided_paths', 'external_courses', 'community', 'learning_analytics', 'development_items', 'development_timeline', 'assessments'))
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  limit_value = EXCLUDED.limit_value;

-- =============================================================================
-- SECTION 4: TRACKS & MODULE TYPES
-- =============================================================================

-- Tracks
INSERT INTO public.tracks (name, key, description, display_order) VALUES
  ('CTA Track', 'cta', 'For Certified Transaction Advisor training and certification', 1),
  ('Leadership Track', 'leadership', 'For leadership development and coaching', 2)
ON CONFLICT (key) DO NOTHING;

-- Module types
INSERT INTO public.module_types (name, description) VALUES
  ('session', 'Live session or workshop'),
  ('assignment', 'Assignment or task'),
  ('reflection', 'Reflection exercise'),
  ('resource', 'Resource or reference material')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SECTION 5: SESSION TYPES & ROLES
-- =============================================================================

INSERT INTO public.session_types (name, description, default_duration_minutes, max_participants, allow_self_registration, feature_key) VALUES
  ('coaching', 'One-on-one coaching session', 60, 2, false, 'session_coaching'),
  ('group_coaching', 'Group coaching session', 90, 12, true, 'session_group'),
  ('workshop', 'Interactive workshop session', 120, 30, true, 'session_workshop'),
  ('mastermind', 'Mastermind group session', 90, 8, true, 'session_group'),
  ('review_board_mock', 'Review board mock session with evaluators', 60, 4, true, 'session_review_board'),
  ('peer_coaching', 'Peer-to-peer coaching session', 45, 2, true, 'session_peer_coaching'),
  ('office_hours', 'Open office hours', 60, 10, true, 'session_group'),
  ('webinar', 'Webinar or presentation', 60, 100, true, 'session_workshop')
ON CONFLICT (name) DO NOTHING;

-- Session type roles
INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'presenter', 'The person presenting their work for review', 1, true, 1 FROM public.session_types WHERE name = 'review_board_mock'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'evaluator', 'Evaluator/Judge providing feedback', 3, true, 2 FROM public.session_types WHERE name = 'review_board_mock'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'observer', 'Observer learning from the session', NULL, false, 3 FROM public.session_types WHERE name = 'review_board_mock'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'facilitator', 'Session facilitator/leader', 2, true, 1 FROM public.session_types WHERE name = 'workshop'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'participant', 'Workshop participant', NULL, false, 2 FROM public.session_types WHERE name = 'workshop'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'hot_seat', 'Person in the hot seat receiving focus', 1, true, 1 FROM public.session_types WHERE name = 'mastermind'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'member', 'Mastermind group member', NULL, false, 2 FROM public.session_types WHERE name = 'mastermind'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'moderator', 'Session moderator', 1, false, 3 FROM public.session_types WHERE name = 'mastermind'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'coach', 'Person acting as coach', 1, true, 1 FROM public.session_types WHERE name = 'peer_coaching'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'coachee', 'Person being coached', 1, true, 2 FROM public.session_types WHERE name = 'peer_coaching'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'presenter', 'Webinar presenter', 3, true, 1 FROM public.session_types WHERE name = 'webinar'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'attendee', 'Webinar attendee', NULL, false, 2 FROM public.session_types WHERE name = 'webinar'
ON CONFLICT (session_type_id, role_name) DO NOTHING;

-- =============================================================================
-- SECTION 6: CREDIT SYSTEM
-- =============================================================================

-- Credit services (central registry for anything that costs credits)
INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'AI Insight', 'Generate an AI insight for decisions', 1, 'ai', id, true
FROM features WHERE key = 'ai_insights'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'AI Recommendation', 'Generate an AI recommendation', 1, 'ai', id, true
FROM features WHERE key = 'ai_recommendations'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Coaching Session', 'Book a 1:1 coaching session', 10, 'sessions', id, true
FROM features WHERE key = 'session_coaching'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Group Session', 'Join a group session', 5, 'sessions', id, true
FROM features WHERE key = 'session_group'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Peer Coaching Session', 'Participate in peer coaching', 3, 'sessions', id, true
FROM features WHERE key = 'session_peer_coaching'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Workshop', 'Attend a workshop session', 8, 'sessions', id, true
FROM features WHERE key = 'session_workshop'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Review Board Session', 'Participate in a review board', 15, 'sessions', id, true
FROM features WHERE key = 'session_review_board'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Base Program Enrollment', 'Enroll in a base program', 25, 'programs', id, true
FROM features WHERE key = 'programs_base'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Pro Program Enrollment', 'Enroll in a pro program', 50, 'programs', id, true
FROM features WHERE key = 'programs_pro'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Advanced Program Enrollment', 'Enroll in an advanced program', 100, 'programs', id, true
FROM features WHERE key = 'programs_advanced'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Micro-learning Course', 'Access a micro-learning or short program', 5, 'programs', id, true
FROM features WHERE key = 'courses_free'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'SF CTA Review Board Mock (Async)', 'Salesforce CTA Review Board Mock - Asynchronous', 75, 'specialty', id, true
FROM features WHERE key = 'sf_cta_rbm_full_asynch'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'SF CTA Review Board Mock (Live)', 'Salesforce CTA Review Board Mock - Live', 150, 'specialty', id, true
FROM features WHERE key = 'sf_cta_rbm_full_live'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Goal Creation', 'Create a new goal', 2, 'goals', id, true
FROM features WHERE key = 'goals'
ON CONFLICT DO NOTHING;

-- Plan credit allocations (feature-specific allocations per plan)
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

-- Individual credit top-up packages
INSERT INTO public.credit_topup_packages (name, slug, description, price_cents, credit_value, currency, validity_months, display_order, is_featured) VALUES
  ('Starter Top-Up', 'starter-topup', 'Quick credit boost', 50000, 55000, 'eur', 24, 1, false),
  ('Standard Top-Up', 'standard-topup', 'Best value top-up', 100000, 120000, 'eur', 24, 2, true),
  ('Premium Top-Up', 'premium-topup', 'Maximum savings', 200000, 260000, 'eur', 24, 3, false)
ON CONFLICT (slug) DO NOTHING;

-- Organization credit packages
INSERT INTO public.org_credit_packages (name, slug, description, price_cents, credit_value, currency, validity_months, display_order) VALUES
  ('Starter Package', 'starter', 'Perfect for trying out the platform', 2500000, 3000000, 'eur', 24, 1),
  ('Growth Package', 'growth', 'Best value for growing teams', 5000000, 6500000, 'eur', 24, 2),
  ('Enterprise Package', 'enterprise', 'Maximum flexibility and savings', 10000000, 14000000, 'eur', 24, 3)
ON CONFLICT (slug) DO NOTHING;

-- Organization platform tiers
INSERT INTO public.org_platform_tiers (name, slug, description, annual_fee_cents, monthly_fee_cents, currency, features, display_order) VALUES
  ('Essentials', 'essentials', 'Core platform access for small teams', 300000, 30000, 'eur', '["Organization dashboard", "Basic analytics", "Up to 10 members", "Email support"]'::jsonb, 1),
  ('Professional', 'professional', 'Advanced features for growing organizations', 500000, 50000, 'eur', '["Everything in Essentials", "Advanced analytics", "Up to 50 members", "Priority support", "Custom branding"]'::jsonb, 2)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- SECTION 7: NOTIFICATION SYSTEM
-- =============================================================================

-- Notification categories
INSERT INTO public.notification_categories (key, name, description, icon, order_index) VALUES
  ('programs', 'Programs & Modules', 'Notifications about your enrolled programs and module updates', 'graduation-cap', 1),
  ('sessions', 'Sessions & Meetings', 'Reminders and updates about scheduled sessions', 'calendar', 2),
  ('assignments', 'Assignments & Feedback', 'Assignment submissions, grades, and instructor feedback', 'file-text', 3),
  ('goals', 'Goals & Progress', 'Goal updates, milestone achievements, and progress reminders', 'target', 4),
  ('decisions', 'Decision Toolkit', 'Decision reminders, follow-ups, and outcome tracking', 'scale', 5),
  ('credits', 'Credits & Billing', 'Credit balance updates, purchases, and billing notifications', 'credit-card', 6),
  ('groups', 'Groups & Collaboration', 'Group activities, discussions, and team updates', 'users', 7),
  ('system', 'System & Account', 'Account updates, security alerts, and platform announcements', 'settings', 8)
ON CONFLICT (key) DO NOTHING;

-- Notification types
INSERT INTO public.notification_types (key, category_id, name, description, icon, is_critical, email_template_key, order_index) VALUES
-- Programs & Modules
('program_enrolled', (SELECT id FROM notification_categories WHERE key = 'programs'), 'Program Enrollment', 'When you are enrolled in a new program', 'book-open', false, 'program_enrollment', 1),
('module_unlocked', (SELECT id FROM notification_categories WHERE key = 'programs'), 'Module Unlocked', 'When a new module becomes available', 'unlock', false, 'module_unlocked', 2),
('module_completed', (SELECT id FROM notification_categories WHERE key = 'programs'), 'Module Completed', 'Confirmation when you complete a module', 'check-circle', false, null, 3),
('program_completed', (SELECT id FROM notification_categories WHERE key = 'programs'), 'Program Completed', 'When you complete a program', 'award', false, 'program_completion', 4),
-- Sessions & Meetings
('session_scheduled', (SELECT id FROM notification_categories WHERE key = 'sessions'), 'Session Scheduled', 'When a new session is scheduled for you', 'calendar-plus', false, 'session_scheduled', 1),
('session_reminder', (SELECT id FROM notification_categories WHERE key = 'sessions'), 'Session Reminder', 'Reminders before upcoming sessions', 'bell', false, 'session_reminder', 2),
('session_cancelled', (SELECT id FROM notification_categories WHERE key = 'sessions'), 'Session Cancelled', 'When a scheduled session is cancelled', 'calendar-x', false, 'session_cancelled', 3),
('session_rescheduled', (SELECT id FROM notification_categories WHERE key = 'sessions'), 'Session Rescheduled', 'When a session time is changed', 'calendar-clock', false, 'session_rescheduled', 4),
-- Assignments & Feedback
('assignment_available', (SELECT id FROM notification_categories WHERE key = 'assignments'), 'New Assignment', 'When a new assignment is available', 'file-plus', false, 'assignment_available', 1),
('assignment_due_soon', (SELECT id FROM notification_categories WHERE key = 'assignments'), 'Assignment Due Soon', 'Reminder before assignment deadline', 'clock', false, 'assignment_due_reminder', 2),
('assignment_graded', (SELECT id FROM notification_categories WHERE key = 'assignments'), 'Assignment Graded', 'When your assignment receives feedback', 'check-square', false, 'assignment_graded', 3),
('feedback_received', (SELECT id FROM notification_categories WHERE key = 'assignments'), 'Feedback Received', 'When instructor provides feedback', 'message-square', false, 'feedback_received', 4),
-- Goals & Progress
('goal_reminder', (SELECT id FROM notification_categories WHERE key = 'goals'), 'Goal Check-in Reminder', 'Periodic reminders to update goal progress', 'target', false, null, 1),
('milestone_achieved', (SELECT id FROM notification_categories WHERE key = 'goals'), 'Milestone Achieved', 'When you complete a goal milestone', 'flag', false, null, 2),
('goal_shared', (SELECT id FROM notification_categories WHERE key = 'goals'), 'Goal Shared With You', 'When someone shares a goal with you', 'share', false, null, 3),
('goal_comment', (SELECT id FROM notification_categories WHERE key = 'goals'), 'Goal Comment', 'When someone comments on your shared goal', 'message-circle', false, null, 4),
-- Decision Toolkit
('decision_reminder', (SELECT id FROM notification_categories WHERE key = 'decisions'), 'Decision Follow-up', 'Reminders to follow up on pending decisions', 'clock', false, 'decision_reminder', 1),
('decision_outcome_due', (SELECT id FROM notification_categories WHERE key = 'decisions'), 'Outcome Review Due', 'Time to review a decision outcome', 'clipboard-check', false, null, 2),
-- Credits & Billing
('credits_low', (SELECT id FROM notification_categories WHERE key = 'credits'), 'Low Credit Balance', 'When your credit balance is running low', 'alert-triangle', false, 'credits_low', 1),
('credits_added', (SELECT id FROM notification_categories WHERE key = 'credits'), 'Credits Added', 'When credits are added to your account', 'plus-circle', false, null, 2),
('credits_expiring', (SELECT id FROM notification_categories WHERE key = 'credits'), 'Credits Expiring Soon', 'Warning before credits expire', 'calendar-clock', false, 'credits_expiring', 3),
('payment_received', (SELECT id FROM notification_categories WHERE key = 'credits'), 'Payment Confirmation', 'Confirmation of payment received', 'check-circle', false, 'payment_confirmation', 4),
-- Groups & Collaboration
('group_joined', (SELECT id FROM notification_categories WHERE key = 'groups'), 'Added to Group', 'When you are added to a group', 'user-plus', false, null, 1),
('group_task_assigned', (SELECT id FROM notification_categories WHERE key = 'groups'), 'Task Assigned', 'When a group task is assigned to you', 'list-todo', false, null, 2),
('group_session_scheduled', (SELECT id FROM notification_categories WHERE key = 'groups'), 'Group Session Scheduled', 'When a group session is scheduled', 'users', false, 'group_session_scheduled', 3),
('group_message', (SELECT id FROM notification_categories WHERE key = 'groups'), 'Group Activity', 'New activity in your groups', 'message-square', false, null, 4),
-- System & Account (some critical)
('security_alert', (SELECT id FROM notification_categories WHERE key = 'system'), 'Security Alert', 'Important security notifications', 'shield-alert', true, 'security_alert', 1),
('account_updated', (SELECT id FROM notification_categories WHERE key = 'system'), 'Account Updated', 'When your account settings change', 'user-cog', true, null, 2),
('terms_updated', (SELECT id FROM notification_categories WHERE key = 'system'), 'Terms Updated', 'When platform terms are updated', 'file-text', true, 'terms_updated', 3),
('platform_announcement', (SELECT id FROM notification_categories WHERE key = 'system'), 'Platform Announcement', 'Important platform announcements', 'megaphone', false, null, 4),
('welcome', (SELECT id FROM notification_categories WHERE key = 'system'), 'Welcome Message', 'Welcome message for new users', 'hand-wave', false, 'welcome', 5)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- SECTION 8: EMAIL TEMPLATES
-- Note: Email templates are large HTML blobs inserted by migration
-- 20260119014103. They will be created by migrations.
-- If they are missing after reset, the notification system still
-- works (emails just won't have HTML templates and will fall back
-- to plain text). We skip them here to keep seed.sql manageable.
-- =============================================================================

-- =============================================================================
-- SECTION 9: WHEEL OF LIFE CATEGORIES
-- =============================================================================

INSERT INTO public.wheel_categories (key, name, description, color, icon, order_index, is_active) VALUES
  ('career', 'Career & Purpose', 'Professional development, career growth, and sense of purpose', '#3B82F6', 'briefcase', 1, true),
  ('finances', 'Finances', 'Financial health, savings, investments, and money management', '#10B981', 'dollar-sign', 2, true),
  ('health', 'Health & Fitness', 'Physical health, exercise, nutrition, and overall wellness', '#EF4444', 'heart', 3, true),
  ('relationships', 'Relationships', 'Personal relationships, family, and social connections', '#F59E0B', 'users', 4, true),
  ('personal_growth', 'Personal Growth', 'Self-improvement, learning, and skill development', '#8B5CF6', 'trending-up', 5, true),
  ('fun_recreation', 'Fun & Recreation', 'Hobbies, leisure activities, and enjoyment of life', '#EC4899', 'smile', 6, true),
  ('environment', 'Physical Environment', 'Living space, work environment, and surroundings', '#06B6D4', 'home', 7, true),
  ('contribution', 'Contribution', 'Giving back, community involvement, and making a difference', '#14B8A6', 'gift', 8, true),
  ('spirituality', 'Spirituality', 'Inner peace, mindfulness, and spiritual practices', '#A78BFA', 'sun', 9, true),
  ('emotional', 'Emotional Wellbeing', 'Mental health, emotional intelligence, and resilience', '#F97316', 'heart-pulse', 10, true)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- SECTION 10: SAMPLE PROGRAMS & MODULES
-- =============================================================================

-- Create admin auth user early so program_versions FK works
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current, email_change_confirm_status,
  phone_change, phone_change_token, reauthentication_token
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'doina.popa@innotrue.com',
  '$2a$10$PwGnGw5T7MaVqKuVY0DWKO.gV0YvuN4VhGQjSJWBLhRhIkRzT5RTe',
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Doina Popa"}'::jsonb,
  'authenticated', 'authenticated', now(), now(),
  '', '',
  '', '', '', 0,
  '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- Disable the auto-version trigger (auth.uid() is NULL during seed)
ALTER TABLE public.programs DISABLE TRIGGER USER;

-- CTA Immersion Premium Program
INSERT INTO public.programs (slug, name, description, category, is_active, credit_cost, min_plan_tier) VALUES
  ('cta-immersion-premium', 'CTA Immersion Premium', 'Comprehensive Salesforce CTA certification preparation program with live coaching, review board mocks, and hands-on practice.', 'cta', true, 100, 2)
ON CONFLICT (slug) DO NOTHING;

-- Leadership Elevate Program
INSERT INTO public.programs (slug, name, description, category, is_active, credit_cost, min_plan_tier) VALUES
  ('leadership-elevate', 'Leadership Elevate', 'Transform your leadership skills through structured coaching, peer learning, and real-world application exercises.', 'leadership', true, 50, 1)
ON CONFLICT (slug) DO NOTHING;

-- Re-enable triggers
ALTER TABLE public.programs ENABLE TRIGGER USER;

-- Manually create initial program versions (since trigger was disabled)
INSERT INTO public.program_versions (program_id, version_number, version_name, created_by, is_current, snapshot_data)
VALUES
  ((SELECT id FROM programs WHERE slug = 'cta-immersion-premium'), 1, 'Initial Version', 'a0000000-0000-0000-0000-000000000001',
   true, '{"name": "CTA Immersion Premium", "category": "cta"}'::jsonb),
  ((SELECT id FROM programs WHERE slug = 'leadership-elevate'), 1, 'Initial Version', 'a0000000-0000-0000-0000-000000000001',
   true, '{"name": "Leadership Elevate", "category": "leadership"}'::jsonb)
ON CONFLICT DO NOTHING;

-- CTA Immersion modules
INSERT INTO public.program_modules (program_id, title, description, module_type, order_index, estimated_minutes, is_active) VALUES
  ((SELECT id FROM programs WHERE slug = 'cta-immersion-premium'), 'CTA Journey Kickoff', 'Introduction to the CTA certification path and program overview.', 'session', 1, 90, true),
  ((SELECT id FROM programs WHERE slug = 'cta-immersion-premium'), 'Architecture Deep Dive', 'Deep dive into Salesforce architecture patterns for CTA-level design.', 'session', 2, 120, true),
  ((SELECT id FROM programs WHERE slug = 'cta-immersion-premium'), 'Case Study Analysis', 'Analyze real-world CTA case studies and develop solution approaches.', 'assignment', 3, 180, true),
  ((SELECT id FROM programs WHERE slug = 'cta-immersion-premium'), 'Solution Design Workshop', 'Hands-on workshop designing enterprise solutions.', 'session', 4, 120, true),
  ((SELECT id FROM programs WHERE slug = 'cta-immersion-premium'), 'Review Board Mock - Async', 'Asynchronous review board mock with written feedback.', 'assignment', 5, 240, true),
  ((SELECT id FROM programs WHERE slug = 'cta-immersion-premium'), 'Review Board Mock - Live', 'Live review board mock session with panel of evaluators.', 'session', 6, 60, true)
ON CONFLICT (program_id, order_index) DO NOTHING;

-- Leadership Elevate modules
INSERT INTO public.program_modules (program_id, title, description, module_type, order_index, estimated_minutes, is_active) VALUES
  ((SELECT id FROM programs WHERE slug = 'leadership-elevate'), 'Leadership Foundations', 'Explore your leadership style and set development goals.', 'session', 1, 90, true),
  ((SELECT id FROM programs WHERE slug = 'leadership-elevate'), 'Self-Assessment & Reflection', 'Complete leadership assessments and reflect on your strengths.', 'reflection', 2, 60, true),
  ((SELECT id FROM programs WHERE slug = 'leadership-elevate'), 'Communication Mastery', 'Learn advanced communication techniques for leaders.', 'session', 3, 90, true),
  ((SELECT id FROM programs WHERE slug = 'leadership-elevate'), 'Team Dynamics Exercise', 'Apply leadership concepts to real team scenarios.', 'assignment', 4, 120, true),
  ((SELECT id FROM programs WHERE slug = 'leadership-elevate'), 'Leadership Action Plan', 'Create your personalized 90-day leadership action plan.', 'resource', 5, 45, true)
ON CONFLICT (program_id, order_index) DO NOTHING;

-- =============================================================================
-- SECTION 11: DEMO USERS
-- =============================================================================
-- Note: auth.users INSERTs work in seed.sql because it runs with service role.
-- Passwords are hashed using bcrypt. The hash below is for 'DemoPass123!'

DO $$
DECLARE
  v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
  v_client1_id UUID := 'c0000000-0000-0000-0000-000000000001';
  v_client2_id UUID := 'c0000000-0000-0000-0000-000000000002';
  v_coach_id UUID := 'd0000000-0000-0000-0000-000000000001';
  v_free_plan_id UUID;
  v_pro_plan_id UUID;
  v_elite_plan_id UUID;
  v_cta_program_id UUID;
  v_leadership_program_id UUID;
  v_enrollment1_id UUID;
  v_enrollment2_id UUID;
BEGIN
  -- Get plan IDs
  SELECT id INTO v_free_plan_id FROM plans WHERE key = 'free';
  SELECT id INTO v_pro_plan_id FROM plans WHERE key = 'pro';
  SELECT id INTO v_elite_plan_id FROM plans WHERE key = 'elite';
  SELECT id INTO v_cta_program_id FROM programs WHERE slug = 'cta-immersion-premium';
  SELECT id INTO v_leadership_program_id FROM programs WHERE slug = 'leadership-elevate';

  -- =========================================================================
  -- Admin user: doina.popa@innotrue.com
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current, email_change_confirm_status,
    phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'doina.popa@innotrue.com',
    '$2a$10$PwGnGw5T7MaVqKuVY0DWKO.gV0YvuN4VhGQjSJWBLhRhIkRzT5RTe', -- DemoPass123!
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Doina Popa"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '',
    '', '', '', 0,
    '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_admin_id, v_admin_id,
    jsonb_build_object('sub', v_admin_id, 'email', 'doina.popa@innotrue.com', 'name', 'Doina Popa'),
    'email', v_admin_id::text, now(), now(), now()
  ) ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.profiles (id, name) VALUES (v_admin_id, 'Doina Popa')
  ON CONFLICT (id) DO UPDATE SET name = 'Doina Popa';

  -- Set admin to Elite plan
  UPDATE public.profiles SET plan_id = v_elite_plan_id WHERE id = v_admin_id;

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role) VALUES (v_admin_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- =========================================================================
  -- Demo Client 1: Sarah Johnson
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current, email_change_confirm_status,
    phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    v_client1_id,
    '00000000-0000-0000-0000-000000000000',
    'sarah.johnson@demo.innotrue.com',
    '$2a$10$PwGnGw5T7MaVqKuVY0DWKO.gV0YvuN4VhGQjSJWBLhRhIkRzT5RTe',
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Sarah Johnson"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '',
    '', '', '', 0,
    '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_client1_id, v_client1_id,
    jsonb_build_object('sub', v_client1_id, 'email', 'sarah.johnson@demo.innotrue.com', 'name', 'Sarah Johnson'),
    'email', v_client1_id::text, now(), now(), now()
  ) ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.profiles (id, name) VALUES (v_client1_id, 'Sarah Johnson')
  ON CONFLICT (id) DO UPDATE SET name = 'Sarah Johnson';

  UPDATE public.profiles SET plan_id = v_pro_plan_id WHERE id = v_client1_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_client1_id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Enroll Sarah in CTA Immersion (skip if already enrolled)
  IF NOT EXISTS (SELECT 1 FROM public.client_enrollments WHERE client_user_id = v_client1_id AND program_id = v_cta_program_id) THEN
    INSERT INTO public.client_enrollments (id, client_user_id, program_id, status, start_date)
    VALUES (gen_random_uuid(), v_client1_id, v_cta_program_id, 'active', CURRENT_DATE - 14);
  END IF;

  -- =========================================================================
  -- Demo Client 2: Michael Chen
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current, email_change_confirm_status,
    phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    v_client2_id,
    '00000000-0000-0000-0000-000000000000',
    'michael.chen@demo.innotrue.com',
    '$2a$10$PwGnGw5T7MaVqKuVY0DWKO.gV0YvuN4VhGQjSJWBLhRhIkRzT5RTe',
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Michael Chen"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '',
    '', '', '', 0,
    '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_client2_id, v_client2_id,
    jsonb_build_object('sub', v_client2_id, 'email', 'michael.chen@demo.innotrue.com', 'name', 'Michael Chen'),
    'email', v_client2_id::text, now(), now(), now()
  ) ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.profiles (id, name) VALUES (v_client2_id, 'Michael Chen')
  ON CONFLICT (id) DO UPDATE SET name = 'Michael Chen';

  UPDATE public.profiles SET plan_id = v_free_plan_id WHERE id = v_client2_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_client2_id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Enroll Michael in Leadership Elevate (skip if already enrolled)
  IF NOT EXISTS (SELECT 1 FROM public.client_enrollments WHERE client_user_id = v_client2_id AND program_id = v_leadership_program_id) THEN
    INSERT INTO public.client_enrollments (id, client_user_id, program_id, status, start_date)
    VALUES (gen_random_uuid(), v_client2_id, v_leadership_program_id, 'active', CURRENT_DATE - 7);
  END IF;

  -- =========================================================================
  -- Demo Coach: Emily Parker
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current, email_change_confirm_status,
    phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    v_coach_id,
    '00000000-0000-0000-0000-000000000000',
    'emily.parker@demo.innotrue.com',
    '$2a$10$PwGnGw5T7MaVqKuVY0DWKO.gV0YvuN4VhGQjSJWBLhRhIkRzT5RTe',
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Emily Parker"}'::jsonb,
    'authenticated', 'authenticated', now(), now(),
    '', '',
    '', '', '', 0,
    '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_coach_id, v_coach_id,
    jsonb_build_object('sub', v_coach_id, 'email', 'emily.parker@demo.innotrue.com', 'name', 'Emily Parker'),
    'email', v_coach_id::text, now(), now(), now()
  ) ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.profiles (id, name) VALUES (v_coach_id, 'Emily Parker')
  ON CONFLICT (id) DO UPDATE SET name = 'Emily Parker';

  UPDATE public.profiles SET plan_id = v_pro_plan_id WHERE id = v_coach_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_coach_id, 'coach')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Assign coach to programs
  INSERT INTO public.program_coaches (program_id, coach_id)
  VALUES (v_cta_program_id, v_coach_id)
  ON CONFLICT (program_id, coach_id) DO NOTHING;

  INSERT INTO public.program_coaches (program_id, coach_id)
  VALUES (v_leadership_program_id, v_coach_id)
  ON CONFLICT (program_id, coach_id) DO NOTHING;

  -- Assign coach to clients
  INSERT INTO public.client_coaches (client_id, coach_id)
  VALUES (v_client1_id, v_coach_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.client_coaches (client_id, coach_id)
  VALUES (v_client2_id, v_coach_id)
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- Module Progress for Sarah (CTA Immersion - 2 modules completed)
  -- =========================================================================
  -- Get Sarah's enrollment
  SELECT id INTO v_enrollment1_id FROM client_enrollments
    WHERE client_user_id = v_client1_id AND program_id = v_cta_program_id LIMIT 1;

  IF v_enrollment1_id IS NOT NULL THEN
    INSERT INTO public.module_progress (enrollment_id, module_id, status, completed_at)
    SELECT v_enrollment1_id, pm.id, 'completed', now() - interval '10 days'
    FROM program_modules pm WHERE pm.program_id = v_cta_program_id AND pm.order_index = 1
    ON CONFLICT DO NOTHING;

    INSERT INTO public.module_progress (enrollment_id, module_id, status, completed_at)
    SELECT v_enrollment1_id, pm.id, 'completed', now() - interval '5 days'
    FROM program_modules pm WHERE pm.program_id = v_cta_program_id AND pm.order_index = 2
    ON CONFLICT DO NOTHING;

    INSERT INTO public.module_progress (enrollment_id, module_id, status)
    SELECT v_enrollment1_id, pm.id, 'in_progress'
    FROM program_modules pm WHERE pm.program_id = v_cta_program_id AND pm.order_index = 3
    ON CONFLICT DO NOTHING;
  END IF;

  -- =========================================================================
  -- Module Progress for Michael (Leadership Elevate - 1 module completed)
  -- =========================================================================
  SELECT id INTO v_enrollment2_id FROM client_enrollments
    WHERE client_user_id = v_client2_id AND program_id = v_leadership_program_id LIMIT 1;

  IF v_enrollment2_id IS NOT NULL THEN
    INSERT INTO public.module_progress (enrollment_id, module_id, status, completed_at)
    SELECT v_enrollment2_id, pm.id, 'completed', now() - interval '3 days'
    FROM program_modules pm WHERE pm.program_id = v_leadership_program_id AND pm.order_index = 1
    ON CONFLICT DO NOTHING;

    INSERT INTO public.module_progress (enrollment_id, module_id, status)
    SELECT v_enrollment2_id, pm.id, 'in_progress'
    FROM program_modules pm WHERE pm.program_id = v_leadership_program_id AND pm.order_index = 2
    ON CONFLICT DO NOTHING;
  END IF;

  -- =========================================================================
  -- Credit balances for demo users
  -- =========================================================================
  INSERT INTO public.user_credit_balances (user_id, available_credits, total_received, total_consumed)
  VALUES
    (v_admin_id, 750, 750, 0),
    (v_client1_id, 230, 250, 20),
    (v_client2_id, 18, 20, 2),
    (v_coach_id, 245, 250, 5)
  ON CONFLICT (user_id) DO UPDATE SET
    available_credits = EXCLUDED.available_credits,
    total_received = EXCLUDED.total_received,
    total_consumed = EXCLUDED.total_consumed;

END $$;

-- =============================================================================
-- SECTION 12: PLATFORM TERMS
-- =============================================================================

INSERT INTO public.platform_terms (version, title, content_html, is_current, is_blocking_on_update, effective_from)
VALUES (
  1,
  'InnoTrue Hub - Terms of Service',
  '<h1>InnoTrue Hub Terms of Service</h1>
<p><strong>Effective Date:</strong> February 1, 2026</p>
<h2>1. Acceptance of Terms</h2>
<p>By accessing or using InnoTrue Hub, you agree to be bound by these Terms of Service.</p>
<h2>2. Description of Service</h2>
<p>InnoTrue Hub is a professional development and coaching platform that provides tools for leadership development, certification preparation, and personal growth.</p>
<h2>3. User Accounts</h2>
<p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
<h2>4. Acceptable Use</h2>
<p>You agree to use InnoTrue Hub only for lawful purposes and in accordance with these Terms.</p>
<h2>5. Intellectual Property</h2>
<p>All content, features, and functionality of InnoTrue Hub are owned by InnoTrue and are protected by international copyright, trademark, and other intellectual property laws.</p>
<h2>6. Privacy</h2>
<p>Your use of InnoTrue Hub is also governed by our Privacy Policy, which is incorporated into these Terms by reference.</p>
<h2>7. Limitation of Liability</h2>
<p>InnoTrue Hub is provided "as is" without warranties of any kind. InnoTrue shall not be liable for any indirect, incidental, or consequential damages.</p>
<h2>8. Changes to Terms</h2>
<p>We reserve the right to modify these Terms at any time. We will notify you of any material changes.</p>
<h2>9. Contact</h2>
<p>For questions about these Terms, contact us at <a href="mailto:support@innotrue.com">support@innotrue.com</a>.</p>',
  true,
  true,
  '2026-02-01T00:00:00Z'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DONE! Summary of seeded data:
-- =============================================================================
-- - 7 system settings
-- - 7 plans (Free, Base, Pro, Advanced, Elite, Programs, Continuation)
-- - 18+ features with plan-feature mappings
-- - 2 tracks (CTA, Leadership)
-- - 4 module types
-- - 8 session types with roles
-- - 15 credit services
-- - 3 individual credit top-up packages
-- - 3 org credit packages + 2 org platform tiers
-- - 8 notification categories + 34 notification types
-- - 10 wheel of life categories
-- - 2 sample programs with 11 total modules
-- - 4 demo users (admin, 2 clients, 1 coach) with enrollments and progress
-- - 1 platform terms document
-- =============================================================================
--
-- Demo Login Credentials:
-- Admin:   doina.popa@innotrue.com / DemoPass123!
-- Client:  sarah.johnson@demo.innotrue.com / DemoPass123!
-- Client:  michael.chen@demo.innotrue.com / DemoPass123!
-- Coach:   emily.parker@demo.innotrue.com / DemoPass123!
-- =============================================================================
