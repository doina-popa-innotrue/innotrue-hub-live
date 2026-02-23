-- =============================================================================
-- Credit Recalibration: Unified 2:1 ratio (1 EUR = 2 credits)
-- =============================================================================
-- Previously, credit ratios were inconsistent:
--   Plans: ~€0.16-0.20 per credit (300 credits for €49/mo)
--   Individual top-ups: ~€0.14-0.20 per credit
--   Org bundles: ~€0.71-0.95 per credit (nearly 1:1)
--
-- New unified ratio: 1 EUR = 2 credits
-- This makes the credit a "digital half-euro" that's psychologically distinct
-- from direct pricing while remaining easy to convert mentally.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Recalibrate plan credit allowances (2x EUR price, rounded nicely)
-- ---------------------------------------------------------------------------
-- Free: 40 (was 20) — freemium teaser, unchanged from 2B.3 migration concept
-- Base €49/mo: 100 credits (was 300)
-- Pro €99/mo: 200 credits (was 500)
-- Advanced €179/mo: 360 credits (was 1000)
-- Elite €249/mo: 500 credits (was 1500)

UPDATE public.plans SET credit_allowance = 40, updated_at = now() WHERE key = 'free';
UPDATE public.plans SET credit_allowance = 100, updated_at = now() WHERE key = 'base';
UPDATE public.plans SET credit_allowance = 200, updated_at = now() WHERE key = 'pro';
UPDATE public.plans SET credit_allowance = 360, updated_at = now() WHERE key = 'advanced';
UPDATE public.plans SET credit_allowance = 500, updated_at = now() WHERE key = 'elite';

-- ---------------------------------------------------------------------------
-- 2. Replace individual top-up packages: 6 tiers from €10 to €8,500
-- ---------------------------------------------------------------------------
-- Deactivate old packages
UPDATE public.credit_topup_packages
SET is_active = false, updated_at = now()
WHERE slug IN ('starter-topup', 'standard-topup', 'premium-topup');

-- Insert 6 new packages at 2:1 ratio
INSERT INTO public.credit_topup_packages
  (name, slug, description, price_cents, credit_value, currency, stripe_price_id, validity_months, display_order, is_active, is_featured)
VALUES
  ('Micro Top-Up',           'micro-topup',           'A few AI insights or goal creations',                                   1000,    20, 'eur', NULL, 12, 1, true, false),
  ('Session Top-Up',         'session-topup',         'Covers one coaching session or group sessions',                          7500,   150, 'eur', NULL, 12, 2, true, false),
  ('Module Top-Up',          'module-topup',          'Enough for a short course or multiple workshops',                       25000,   500, 'eur', NULL, 12, 3, true, true),
  ('Program Top-Up',         'program-topup',         'Covers a small program enrollment',                                   150000,  3000, 'eur', NULL, 12, 4, true, false),
  ('Premium Program Top-Up', 'premium-program-topup', 'Covers a mid-tier program enrollment with credits to spare',          450000,  9000, 'eur', NULL, 12, 5, true, false),
  ('Immersion Top-Up',       'immersion-topup',       'Covers premium program enrollment (e.g. CTA Immersion) with surplus', 850000, 17000, 'eur', NULL, 12, 6, true, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  credit_value = EXCLUDED.credit_value,
  stripe_price_id = NULL,
  validity_months = EXCLUDED.validity_months,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Recalibrate org credit bundles to 2:1 base + volume bonus
-- ---------------------------------------------------------------------------
-- Deactivate current bundles (will be replaced with recalibrated versions)
UPDATE public.org_credit_packages
SET is_active = false, updated_at = now()
WHERE slug LIKE 'bundle-%';

-- Insert recalibrated bundles: base = 2x EUR price, then + bonus %
-- €500 × 2 = 1,000 base + 5% bonus = 1,050
-- €1,000 × 2 = 2,000 base + 10% = 2,200
-- etc.
INSERT INTO public.org_credit_packages
  (name, slug, description, price_cents, credit_value, currency, stripe_price_id, validity_months, display_order, is_active)
VALUES
  ('Credit Bundle - 1,050 Credits',  'bundle-1050',  '1,000 base + 50 bonus (5%) — great for testing or a small pilot',           50000,   1050, 'eur', NULL, 12, 1, true),
  ('Credit Bundle - 2,200 Credits',  'bundle-2200',  '2,000 base + 200 bonus (10%) — enough for a small team pilot',             100000,   2200, 'eur', NULL, 12, 2, true),
  ('Credit Bundle - 5,750 Credits',  'bundle-5750',  '5,000 base + 750 bonus (15%) — perfect for small teams (5-10 members)',    250000,   5750, 'eur', NULL, 12, 3, true),
  ('Credit Bundle - 12,000 Credits', 'bundle-12000', '10,000 base + 2,000 bonus (20%) — ideal for growing teams (10-20)',        500000,  12000, 'eur', NULL, 12, 4, true),
  ('Credit Bundle - 18,750 Credits', 'bundle-18750', '15,000 base + 3,750 bonus (25%) — great value for mid-size teams',         750000,  18750, 'eur', NULL, 12, 5, true),
  ('Credit Bundle - 26,000 Credits', 'bundle-26000', '20,000 base + 6,000 bonus (30%) — best for large teams (20-35)',          1000000,  26000, 'eur', NULL, 12, 6, true),
  ('Credit Bundle - 40,500 Credits', 'bundle-40500', '30,000 base + 10,500 bonus (35%) — premium for large organizations',     1500000,  40500, 'eur', NULL, 12, 7, true),
  ('Credit Bundle - 56,000 Credits', 'bundle-56000', '40,000 base + 16,000 bonus (40%) — maximum savings for enterprise',      2000000,  56000, 'eur', NULL, 12, 8, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  credit_value = EXCLUDED.credit_value,
  stripe_price_id = NULL,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 4. Recalibrate credit service costs to 2:1
-- ---------------------------------------------------------------------------
-- AI services: 1 → 2 credits (EUR 1)
UPDATE public.credit_services SET credit_cost = 2, updated_at = now()
WHERE category = 'ai' AND credit_cost = 1;

-- Goal creation: 2 → 4 credits (EUR 2)
UPDATE public.credit_services SET credit_cost = 4, updated_at = now()
WHERE category = 'goals' AND credit_cost = 2;

-- Peer coaching: 3 → 60 credits (EUR 30)
UPDATE public.credit_services SET credit_cost = 60, updated_at = now()
WHERE name ILIKE '%peer%' AND category = 'sessions';

-- Group session: 5 → 100 credits (EUR 50)
UPDATE public.credit_services SET credit_cost = 100, updated_at = now()
WHERE name ILIKE '%group%' AND category = 'sessions';

-- Workshop: 8 → 150 credits (EUR 75)
UPDATE public.credit_services SET credit_cost = 150, updated_at = now()
WHERE name ILIKE '%workshop%' AND category = 'sessions';

-- Coaching (1:1): 10 → 200 credits (EUR 100)
UPDATE public.credit_services SET credit_cost = 200, updated_at = now()
WHERE name ILIKE '%coaching session%' AND category = 'sessions';

-- Review board: 15 → 300 credits (EUR 150)
UPDATE public.credit_services SET credit_cost = 300, updated_at = now()
WHERE name ILIKE '%review board%' AND category = 'sessions';

-- Base program: 25 → 500 credits (EUR 250)
UPDATE public.credit_services SET credit_cost = 500, updated_at = now()
WHERE name ILIKE '%base program%' AND category = 'programs';

-- Pro program: 50 → 2000 credits (EUR 1,000)
UPDATE public.credit_services SET credit_cost = 2000, updated_at = now()
WHERE name ILIKE '%pro program%' AND category = 'programs';

-- Advanced program: 100 → 6000 credits (EUR 3,000)
UPDATE public.credit_services SET credit_cost = 6000, updated_at = now()
WHERE name ILIKE '%advanced program%' AND category = 'programs';

-- Micro-learning: 5 → 100 credits (EUR 50)
UPDATE public.credit_services SET credit_cost = 100, updated_at = now()
WHERE name ILIKE '%micro%' AND category = 'programs';

-- RBM async: 75 → 300 credits (EUR 150)
UPDATE public.credit_services SET credit_cost = 300, updated_at = now()
WHERE name ILIKE '%rbm%async%' OR (name ILIKE '%review board mock%async%');

-- RBM live: 150 → 1500 credits (EUR 750)
UPDATE public.credit_services SET credit_cost = 1500, updated_at = now()
WHERE name ILIKE '%rbm%live%' OR (name ILIKE '%review board mock%live%');

-- ---------------------------------------------------------------------------
-- 5. Update program seed credit costs (program_tier_plans populated via admin UI,
--    but the base programs.credit_cost column needs updating)
-- ---------------------------------------------------------------------------
-- CTA Immersion Premium: was 100, now 16896 (EUR 8,448)
UPDATE public.programs SET credit_cost = 16896, updated_at = now()
WHERE slug = 'cta-immersion-premium' AND credit_cost = 100;

-- Leadership Elevate: was 50, now 2000 (EUR 1,000)
UPDATE public.programs SET credit_cost = 2000, updated_at = now()
WHERE slug = 'leadership-elevate' AND credit_cost = 50;

-- ---------------------------------------------------------------------------
-- 6. Stripe price IDs: NULL out changed packages so new products auto-create
-- ---------------------------------------------------------------------------
-- Individual top-ups: all new packages have NULL stripe_price_id already
-- Org bundles: new slugs have NULL already, but old ones with Stripe IDs need clearing
-- (old bundles are deactivated, new ones have no stripe_price_id)

-- Note: plan_prices.stripe_price_id was already NULLed by the 2B.3 pricing update
-- migration. No further action needed for plans.
