-- =============================================================================
-- Migration: Replace goal_category enum with TEXT + FK to wheel_categories
-- =============================================================================
-- The goal_category enum accumulated 21 values across 3 migrations, many
-- overlapping. The wheel_categories table is the dynamic source of truth
-- (with an admin UI). Replacing the rigid enum with a TEXT column + FK
-- gives the same data integrity but lets admins manage categories without
-- migrations.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Ensure the 10 active wheel_categories exist (idempotent, already
-- done in previous migration but repeated for safety)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.wheel_categories (key, name, description, color, icon, order_index, is_active, is_legacy)
VALUES
  ('career',          'Career & Purpose',      'Professional development, career growth, and sense of purpose',       '#3B82F6', 'briefcase',    1, true, false),
  ('finances',        'Finances',              'Financial health, savings, investments, and money management',        '#10B981', 'dollar-sign',  2, true, false),
  ('health',          'Health & Fitness',       'Physical health, exercise, nutrition, and overall wellness',          '#EF4444', 'heart',        3, true, false),
  ('relationships',   'Relationships',         'Personal relationships, family, and social connections',              '#F59E0B', 'users',        4, true, false),
  ('personal_growth', 'Personal Growth',       'Self-improvement, learning, and skill development',                  '#8B5CF6', 'trending-up',  5, true, false),
  ('fun_recreation',  'Fun & Recreation',      'Hobbies, leisure activities, and enjoyment of life',                 '#EC4899', 'smile',        6, true, false),
  ('environment',     'Physical Environment',  'Living space, work environment, and surroundings',                   '#06B6D4', 'home',         7, true, false),
  ('contribution',    'Contribution',          'Giving back, community involvement, and making a difference',        '#14B8A6', 'gift',         8, true, false),
  ('spirituality',    'Spirituality',          'Inner peace, mindfulness, and spiritual practices',                  '#A78BFA', 'sun',          9, true, false),
  ('emotional',       'Emotional Wellbeing',   'Mental health, emotional intelligence, and resilience',              '#F97316', 'heart-pulse', 10, true, false)
ON CONFLICT (key) DO UPDATE SET
  is_active = true,
  is_legacy = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Map existing goals using old category values to the new 10 keys
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.goals SET category = 'career'        WHERE category IN ('career_business', 'financial_career');
UPDATE public.goals SET category = 'health'        WHERE category IN ('health_fitness', 'physical_health');
UPDATE public.goals SET category = 'environment'   WHERE category IN ('physical_environment', 'family_home');
UPDATE public.goals SET category = 'relationships' WHERE category IN ('family_friends', 'romance', 'social_cultural');
UPDATE public.goals SET category = 'personal_growth' WHERE category = 'mental_educational';
UPDATE public.goals SET category = 'spirituality'  WHERE category = 'spiritual_ethical';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Convert column from enum to TEXT + add FK
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.goals
  ALTER COLUMN category TYPE TEXT USING category::TEXT;

ALTER TABLE public.goals
  ADD CONSTRAINT goals_category_fk
  FOREIGN KEY (category) REFERENCES public.wheel_categories(key);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Drop the now-unused enum type
-- ─────────────────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS public.goal_category;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Deactivate legacy wheel_categories rows (keep for historical
-- reference but hide from dropdowns)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.wheel_categories
SET is_active = false, is_legacy = true
WHERE key IN (
  'family_home', 'financial_career', 'mental_educational',
  'spiritual_ethical', 'social_cultural', 'physical_health',
  'health_fitness', 'career_business', 'physical_environment',
  'family_friends', 'romance'
);
