-- =============================================================================
-- Migration: Add admin_notes column to features table + fix system flags
-- =============================================================================
-- Purpose:
--   1. Add admin_notes column for internal documentation (visible to admins only)
--   2. Mark ai_coach, coach_dashboard, org_analytics as system features
--   3. Populate admin_notes for all features with operational context
-- =============================================================================

-- 1. Add admin_notes column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'features'
      AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE public.features ADD COLUMN admin_notes text;
    COMMENT ON COLUMN public.features.admin_notes IS
      'Internal notes for administrators. Not visible to clients or staff. Documents purpose, gating behavior, and configuration guidance.';
  END IF;
END;
$$;

-- 2. Mark missing system features
UPDATE public.features SET is_system = true WHERE key IN (
  'ai_coach',         -- Core AI feature with per-plan limits
  'coach_dashboard',  -- Role-specific system feature for coach UI
  'org_analytics'     -- Org admin analytics feature
) AND is_system = false;

-- 3. Populate admin_notes for ALL features
-- These notes are for admin reference only — never shown to clients

-- Core decision features
UPDATE public.features SET admin_notes =
  'SYSTEM. Gates the Decisions page via FeatureGate. Free plan gets basic, Pro+ gets advanced. Cannot be deleted.'
WHERE key = 'decision_toolkit_basic';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates advanced decision analytics, outcomes, and follow-ups via CapabilityGate. Available from Pro plan upward.'
WHERE key = 'decision_toolkit_advanced';

-- AI features
UPDATE public.features SET admin_notes =
  'SYSTEM. Consumable with per-plan monthly limits (Free: 20, Base: 50, Pro: 200, Advanced: 500, Elite: 1000). Powers AI coaching recommendations. Limit tracked via get_current_usage RPC.'
WHERE key = 'ai_coach';

UPDATE public.features SET admin_notes =
  'SYSTEM. Consumable. Gates AI-powered insights on decisions page via FeatureGate. Per-plan limits (Free: 5, Base: 50, Pro: 100, Advanced: 200, Elite: 300).'
WHERE key = 'ai_insights';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates AI-powered course and goal recommendations via FeatureGate. Available from Advanced plan upward. Non-consumable toggle.'
WHERE key = 'ai_recommendations';

-- Session features (consumable)
UPDATE public.features SET admin_notes =
  'Consumable. Per-plan monthly limit (Free: 1, Base: 3, Pro: 5, Advanced: 10, Elite: 20). Linked to session_types via module system. Limit enforced at booking time.'
WHERE key = 'session_coaching';

UPDATE public.features SET admin_notes =
  'Consumable. Available from Base plan. No per-plan limit set (unlimited within plan). Group coaching and mastermind sessions.'
WHERE key = 'session_group';

UPDATE public.features SET admin_notes =
  'Consumable. Available from Pro plan. Workshop and training session access.'
WHERE key = 'session_workshop';

UPDATE public.features SET admin_notes =
  'Consumable. Available from Advanced plan. Review board mock sessions with evaluators. Used for CTA certification preparation.'
WHERE key = 'session_review_board';

UPDATE public.features SET admin_notes =
  'Consumable. Available from Pro plan. Peer-to-peer coaching sessions.'
WHERE key = 'session_peer_coaching';

-- Program features (consumable)
UPDATE public.features SET admin_notes =
  'Consumable. Gates access to base-tier program enrollments. Available from Pro plan. Enrollment requires credit purchase.'
WHERE key = 'programs_base';

UPDATE public.features SET admin_notes =
  'Consumable. Gates access to pro-tier program enrollments. Available from Advanced plan.'
WHERE key = 'programs_pro';

UPDATE public.features SET admin_notes =
  'Consumable. Gates access to advanced-tier program enrollments. Elite plan only.'
WHERE key = 'programs_advanced';

UPDATE public.features SET admin_notes =
  'Consumable. Gates access to micro-learning and short programs/courses. Available from Base plan.'
WHERE key = 'courses_free';

-- Specialty features
UPDATE public.features SET admin_notes =
  'Consumable. Salesforce CTA Review Board Mock — Asynchronous format. Elite plan only. Specialty certification feature.'
WHERE key = 'sf_cta_rbm_full_asynch';

UPDATE public.features SET admin_notes =
  'Consumable. Salesforce CTA Review Board Mock — Live format with evaluators. Elite plan only. Specialty certification feature.'
WHERE key = 'sf_cta_rbm_full_live';

-- Core consumable
UPDATE public.features SET admin_notes =
  'SYSTEM. Consumable. Gates Goals page via FeatureGate. Available on all plans (Free→Elite). Goal creation/tracking.'
WHERE key = 'goals';

-- Platform gating features (UI pages/sidebar items)
UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Credits page and sidebar menu item. Enabled on ALL plans (Free→Elite). Controls access to credit balance view and top-up purchase UI. Without this feature, users cannot see or buy credits.'
WHERE key = 'credits';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Skills Map page via FeatureGate. Available from Base plan. Skill tracking and profile sharing.'
WHERE key = 'skills_map';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Services browse page via FeatureGate. Available from Base plan. Shows available credit services and costs.'
WHERE key = 'services';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Usage Overview page via FeatureGate. Available on all plans (Free→Elite). Shows AI credits and feature consumption tracking.'
WHERE key = 'usage';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Guided Paths page via FeatureGate. Available from Pro plan. Curated learning paths with goals and milestones.'
WHERE key = 'guided_paths';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates External Courses page via FeatureGate. Available from Pro plan. Track courses from external platforms (Udemy, Coursera, etc.).'
WHERE key = 'external_courses';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Community page via FeatureGate. Available from Advanced plan. Circle.so SSO integration for community access.'
WHERE key = 'community';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Wheel of Life self-assessment tool via FeatureGate. Available on all plans (Free→Elite). PDF export capability.'
WHERE key = 'wheel_of_life';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Capability Assessments via dynamic FeatureGate (assessment-specific keys). Available from Base plan. Psychometric and capability evaluations.'
WHERE key = 'assessments';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Learning Analytics page via hasFeature check. Available from Pro plan. Learning progress dashboards and insights.'
WHERE key = 'learning_analytics';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Programs section in sidebar and program enrollment pages. Available on all plans (Free→Elite) but program-tier features control which programs are accessible.'
WHERE key = 'programs';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Peer Groups page via FeatureGate. Available on all plans (Free→Elite). Group collaboration features.'
WHERE key = 'groups';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Tasks page in sidebar. Available on all plans (Free→Elite). Task management and tracking.'
WHERE key = 'tasks';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Development Items page. Available on all plans (Free→Elite). Action point tracking for coaching.'
WHERE key = 'development_items';

UPDATE public.features SET admin_notes =
  'SYSTEM. Gates Development Timeline page via FeatureGate. Available on all plans (Free→Elite). Visual progress over time.'
WHERE key = 'development_timeline';

-- Role-specific features
UPDATE public.features SET admin_notes =
  'SYSTEM. Role-specific feature for coaches. Gates the dedicated coach dashboard UI. Available from Pro plan. Combined with coach role check.'
WHERE key = 'coach_dashboard';

UPDATE public.features SET admin_notes =
  'SYSTEM. Role-specific feature for org admins. Enterprise-level analytics and reporting. Elite plan only.'
WHERE key = 'org_analytics';
