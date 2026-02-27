-- =============================================================================
-- Migration: Fix goal_category enum + populate wheel_categories
-- =============================================================================
-- Two issues:
-- 1. The goal_category enum is missing 5 values that match the current
--    wheel_categories keys: career, health, environment, spirituality, emotional.
--    Selecting any of these in the Goal form causes an INSERT failure.
-- 2. wheel_categories data was only in seed.sql, never in a migration.
--    Production may be missing rows or have stale data.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Add missing values to goal_category enum
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'career';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'health';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'environment';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'spirituality';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'emotional';

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Ensure all 10 wheel_categories exist (idempotent)
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
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active   = true,
  is_legacy   = false;

-- Mark the original 6 enum categories as legacy (if they exist as wheel_categories rows)
UPDATE public.wheel_categories
SET is_legacy = true
WHERE key IN ('family_home', 'financial_career', 'mental_educational', 'spiritual_ethical', 'social_cultural', 'physical_health')
  AND is_legacy = false;
