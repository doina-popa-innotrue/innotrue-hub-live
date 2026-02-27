-- Add snapshot_key column to wheel_categories.
-- Maps each goal category to its corresponding wheel_of_life_snapshots column name.
-- Some categories share a snapshot column (e.g. relationships covers family_friends
-- + romance), and some have no snapshot column (spirituality, emotional → NULL).
--
-- WARNING: snapshot_key values MUST match actual column names in wheel_of_life_snapshots.
-- Do NOT change them unless the DB column names change.

ALTER TABLE public.wheel_categories
  ADD COLUMN IF NOT EXISTS snapshot_key TEXT;

UPDATE public.wheel_categories SET snapshot_key = 'career_business'       WHERE key = 'career';
UPDATE public.wheel_categories SET snapshot_key = 'finances'              WHERE key = 'finances';
UPDATE public.wheel_categories SET snapshot_key = 'health_fitness'        WHERE key = 'health';
UPDATE public.wheel_categories SET snapshot_key = 'relationships'         WHERE key = 'relationships';
UPDATE public.wheel_categories SET snapshot_key = 'personal_growth'       WHERE key = 'personal_growth';
UPDATE public.wheel_categories SET snapshot_key = 'fun_recreation'        WHERE key = 'fun_recreation';
UPDATE public.wheel_categories SET snapshot_key = 'physical_environment'  WHERE key = 'environment';
UPDATE public.wheel_categories SET snapshot_key = 'contribution'          WHERE key = 'contribution';

COMMENT ON COLUMN public.wheel_categories.snapshot_key IS
  'Corresponding column name in wheel_of_life_snapshots. Do NOT change unless DB columns change.';
