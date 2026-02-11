-- =============================================================================
-- Add missing gating features and mark all UI-gating features as is_system
-- =============================================================================
-- These features are referenced by FeatureGate components and sidebar navigation
-- in the frontend. Without them, pages/sidebar items are permanently locked.
-- Marking them as is_system prevents accidental deletion/rename in admin UI.

-- Insert features that were created by migration 20260119200433 but may be
-- missing if that migration didn't run or was skipped
INSERT INTO public.features (key, name, description) VALUES
  ('credits', 'Credits', 'View credit balance and purchase top-ups'),
  ('skills_map', 'Skills Map', 'Track acquired skills and share on profile'),
  ('services', 'Services', 'Browse available services and credit costs'),
  ('usage', 'Usage Overview', 'Track AI credits and feature consumption'),
  ('guided_paths', 'Guided Paths', 'Follow curated paths with goals and milestones'),
  ('external_courses', 'External Courses', 'Track courses from other platforms')
ON CONFLICT (key) DO NOTHING;

-- Insert features that are referenced in code but were never in any migration
INSERT INTO public.features (key, name, description) VALUES
  ('community', 'Community', 'Community features and discussions'),
  ('wheel_of_life', 'Wheel of Life', 'Self-assessment wheel of life tool'),
  ('assessments', 'Assessments', 'Capability assessments and evaluations'),
  ('learning_analytics', 'Learning Analytics', 'Learning progress analytics and insights'),
  ('tasks', 'Tasks', 'Task management and tracking'),
  ('development_items', 'Development Items', 'Track development items and action points'),
  ('development_timeline', 'Development Timeline', 'View development progress over time')
ON CONFLICT (key) DO NOTHING;

-- Mark all UI-gating features as is_system (cannot be deleted or renamed in admin UI)
-- This extends the original is_system migration (20260113003008) which only covered 11 features
UPDATE public.features SET is_system = true WHERE key IN (
  -- Already marked by 20260113003008 (re-asserting for safety)
  'goals', 'wheel_of_life', 'decision_toolkit_basic', 'decision_toolkit_advanced',
  'assessments', 'ai_recommendations', 'ai_insights', 'programs', 'groups',
  'community', 'learning_analytics',
  -- Newly marked: these gate pages/sidebar items via FeatureGate
  'credits', 'skills_map', 'services', 'usage', 'guided_paths', 'external_courses',
  -- Newly marked: these control tour step visibility
  'tasks', 'development_items', 'development_timeline'
);
