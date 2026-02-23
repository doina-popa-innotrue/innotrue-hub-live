-- ============================================================================
-- Sync org_credit_packages with Stripe "Credit Bundle" products
-- ============================================================================
-- The Stripe account already has 8 "Credit Bundle" products with prices.
-- This migration replaces the previous 3 placeholder org packages with the
-- full set of 8 bundles, each linked to its Stripe product/price ID.
--
-- Stripe products were created on 2026-03-01 with the naming convention:
--   "Credit Bundle - {total_credits} Credits"
-- where total_credits = base_credits + bonus_credits (percentage-based bonus).
--
-- Bonus tiers:
--   €500  → 5% bonus   (500 + 25 = 525)
--   €1000 → 10% bonus  (1000 + 100 = 1,100)
--   €2500 → 15% bonus  (2500 + 375 = 2,875)
--   €5000 → 20% bonus  (5000 + 1000 = 6,000)
--   €7500 → 25% bonus  (7500 + 1875 = 9,375)
--   €10000→ 30% bonus  (10000 + 3000 = 13,000)
--   €15000→ 35% bonus  (15000 + 5250 = 20,250)
--   €20000→ 40% bonus  (20000 + 8000 = 28,000)
-- ============================================================================

-- 1. Deactivate old org packages that don't map to Stripe bundles
--    (keeping them in DB for historical purchase records)
UPDATE public.org_credit_packages
SET is_active = false, updated_at = now()
WHERE slug IN ('starter', 'growth', 'enterprise')
  AND stripe_price_id IS NULL;

-- 2. Insert all 8 Credit Bundle packages linked to Stripe
INSERT INTO public.org_credit_packages
  (name, slug, description, price_cents, credit_value, currency, stripe_price_id, validity_months, display_order, is_active)
VALUES
  -- Tier 1: €500 / 525 credits (5% bonus)
  ('Credit Bundle - 525 Credits',
   'bundle-525',
   '500 credits + 25 bonus (5% extra) — great for testing or a small pilot',
   50000, 525, 'eur',
   'price_1SqR2cKTUzwyKyi3uAIH6MEt',
   12, 1, true),

  -- Tier 2: €1,000 / 1,100 credits (10% bonus)
  ('Credit Bundle - 1,100 Credits',
   'bundle-1100',
   '1,000 credits + 100 bonus (10% extra) — enough for a small team pilot',
   100000, 1100, 'eur',
   'price_1SqR33KTUzwyKyi3l2dJ8gcb',
   12, 2, true),

  -- Tier 3: €2,500 / 2,875 credits (15% bonus)
  ('Credit Bundle - 2,875 Credits',
   'bundle-2875',
   '2,500 credits + 375 bonus (15% extra) — perfect for small teams (5-10 members)',
   250000, 2875, 'eur',
   'price_1SqR3QKTUzwyKyi38wHvLsBh',
   12, 3, true),

  -- Tier 4: €5,000 / 6,000 credits (20% bonus)
  ('Credit Bundle - 6,000 Credits',
   'bundle-6000',
   '5,000 credits + 1,000 bonus (20% extra) — ideal for growing teams (10-20 members)',
   500000, 6000, 'eur',
   'price_1SqR3kKTUzwyKyi3yq5pI8TR',
   12, 4, true),

  -- Tier 5: €7,500 / 9,375 credits (25% bonus)
  ('Credit Bundle - 9,375 Credits',
   'bundle-9375',
   '7,500 credits + 1,875 bonus (25% extra) — great value for mid-size teams (15-25 members)',
   750000, 9375, 'eur',
   'price_1SqR7MKTUzwyKyi3k5Adok6m',
   12, 5, true),

  -- Tier 6: €10,000 / 13,000 credits (30% bonus)
  ('Credit Bundle - 13,000 Credits',
   'bundle-13000',
   '10,000 credits + 3,000 bonus (30% extra) — best for large teams (20-35 members)',
   1000000, 13000, 'eur',
   'price_1SqR7WKTUzwyKyi3C3W53I8L',
   12, 6, true),

  -- Tier 7: €15,000 / 20,250 credits (35% bonus)
  ('Credit Bundle - 20,250 Credits',
   'bundle-20250',
   '15,000 credits + 5,250 bonus (35% extra) — premium tier for large organizations (30-50 members)',
   1500000, 20250, 'eur',
   'price_1SqR7gKTUzwyKyi34HWzcSe9',
   12, 7, true),

  -- Tier 8: €20,000 / 28,000 credits (40% bonus)
  ('Credit Bundle - 28,000 Credits',
   'bundle-28000',
   '20,000 credits + 8,000 bonus (40% extra) — maximum savings for enterprise teams (50+ members)',
   2000000, 28000, 'eur',
   'price_1SqR81KTUzwyKyi3OnZfVqrp',
   12, 8, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  credit_value = EXCLUDED.credit_value,
  stripe_price_id = EXCLUDED.stripe_price_id,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();
