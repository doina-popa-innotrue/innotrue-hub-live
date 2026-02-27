-- Align Wheel of Life to industry-standard 10 categories:
--   Health & Well-being, Career & Work, Finances, Relationships,
--   Personal Growth, Fun & Recreation, Physical Environment,
--   Spirituality & Faith, Love & Intimacy, Contribution & Service
--
-- Changes:
--   1. Add spirituality column to wheel_of_life_snapshots
--   2. Reactivate romance in wheel_categories (was legacy)
--   3. Deactivate emotional in wheel_categories (non-standard)
--   4. Update labels to match industry standard names
--   5. Update snapshot_key mappings

-- 1. Add spirituality column to snapshots
ALTER TABLE public.wheel_of_life_snapshots
  ADD COLUMN IF NOT EXISTS spirituality smallint;

-- 2. Reactivate romance as "Love & Intimacy"
UPDATE public.wheel_categories
SET is_active = true,
    is_legacy = false,
    name = 'Love & Intimacy',
    description = 'Your romantic relationship, intimacy, and partnership satisfaction.',
    snapshot_key = 'romance',
    order_index = 9
WHERE key = 'romance';

-- 3. Deactivate emotional (not in industry standard)
UPDATE public.wheel_categories
SET is_active = false, is_legacy = true
WHERE key = 'emotional';

-- 4. Update spirituality snapshot_key (now has a real column)
UPDATE public.wheel_categories
SET snapshot_key = 'spirituality',
    name = 'Spirituality & Faith',
    description = 'Your connection to something greater, sources of meaning, and spiritual practices.'
WHERE key = 'spirituality';

-- 5. Update other labels to match industry standard
UPDATE public.wheel_categories SET name = 'Health & Well-being',
  description = 'Your physical health, emotional wellness, energy levels, and overall well-being.'
  WHERE key = 'health';

UPDATE public.wheel_categories SET name = 'Career & Work',
  description = 'Your professional life, job satisfaction, career growth, and work achievements.'
  WHERE key = 'career';

UPDATE public.wheel_categories SET name = 'Contribution & Service',
  description = 'Your impact on others, community involvement, volunteer work, and sense of purpose.'
  WHERE key = 'contribution';

-- 6. Set order_index for standard display order
UPDATE public.wheel_categories SET order_index = 1 WHERE key = 'health';
UPDATE public.wheel_categories SET order_index = 2 WHERE key = 'career';
UPDATE public.wheel_categories SET order_index = 3 WHERE key = 'finances';
UPDATE public.wheel_categories SET order_index = 4 WHERE key = 'relationships';
UPDATE public.wheel_categories SET order_index = 5 WHERE key = 'personal_growth';
UPDATE public.wheel_categories SET order_index = 6 WHERE key = 'fun_recreation';
UPDATE public.wheel_categories SET order_index = 7 WHERE key = 'environment';
UPDATE public.wheel_categories SET order_index = 8 WHERE key = 'spirituality';
UPDATE public.wheel_categories SET order_index = 9 WHERE key = 'romance';
UPDATE public.wheel_categories SET order_index = 10 WHERE key = 'contribution';
