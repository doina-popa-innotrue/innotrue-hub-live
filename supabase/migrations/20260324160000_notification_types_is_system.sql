-- =============================================================================
-- Migration: Add is_system protection to notification_categories & notification_types
-- =============================================================================
-- Adds an is_system boolean column (default false) to both tables.
-- All existing seeded categories and types are marked as system records.
-- System records cannot be deleted or have their key renamed via the admin UI.
-- Display properties (name, description, icon, order, defaults) remain editable.
-- =============================================================================

-- 1. Add is_system column to notification_categories
ALTER TABLE public.notification_categories
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 2. Add is_system column to notification_types
ALTER TABLE public.notification_types
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 3. Mark all existing seeded categories as system
UPDATE public.notification_categories
SET is_system = true
WHERE key IN (
  'programs', 'sessions', 'assignments', 'goals',
  'decisions', 'credits', 'groups', 'system'
);

-- 4. Mark all existing seeded notification types as system
UPDATE public.notification_types
SET is_system = true
WHERE key IN (
  -- Programs & Modules
  'program_enrolled', 'module_unlocked', 'module_completed', 'program_completed',
  -- Sessions & Meetings
  'session_scheduled', 'session_reminder', 'session_cancelled', 'session_rescheduled',
  -- Assignments & Feedback
  'assignment_available', 'assignment_due_soon', 'assignment_graded', 'feedback_received',
  -- Goals & Progress
  'goal_reminder', 'milestone_achieved', 'goal_shared', 'goal_comment',
  -- Decision Toolkit
  'decision_reminder', 'decision_outcome_due',
  -- Credits & Billing
  'credits_low', 'credits_added', 'credits_expiring', 'payment_received',
  -- Groups & Collaboration
  'group_joined', 'group_task_assigned', 'group_session_scheduled', 'group_message',
  -- System & Account
  'security_alert', 'account_updated', 'terms_updated', 'platform_announcement', 'welcome'
);
