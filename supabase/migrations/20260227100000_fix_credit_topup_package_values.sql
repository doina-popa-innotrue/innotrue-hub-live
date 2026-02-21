-- Fix credit top-up package values to be consistent with the credit scale
-- Plan allowances: Free=20, Base=150, Pro=250, Advanced=500, Elite=750 credits/month
-- Credit service costs: AI=1, sessions=3-15, programs=25-100, RBM live=150
-- Top-up packages should give roughly 1-6 months' worth of plan credits

-- Individual credit top-up packages (corrected values)
-- Old values were wildly out of scale (55,000 credits for €5 etc.)
UPDATE public.credit_topup_packages
SET credit_value = 50, price_cents = 999, validity_months = 12,
    description = 'Quick credit boost for a few AI queries or a session'
WHERE slug = 'starter-topup';

UPDATE public.credit_topup_packages
SET credit_value = 150, price_cents = 2499, validity_months = 12,
    description = 'Enough for a program enrollment or multiple sessions'
WHERE slug = 'standard-topup';

UPDATE public.credit_topup_packages
SET credit_value = 500, price_cents = 6999, validity_months = 12,
    description = 'Maximum savings — covers multiple programs and sessions'
WHERE slug = 'premium-topup';

-- Insert if they don't exist yet (for fresh environments)
INSERT INTO public.credit_topup_packages
  (name, slug, description, price_cents, credit_value, currency, validity_months, display_order, is_featured)
VALUES
  ('Starter Top-Up', 'starter-topup', 'Quick credit boost for a few AI queries or a session', 999, 50, 'eur', 12, 1, false),
  ('Standard Top-Up', 'standard-topup', 'Enough for a program enrollment or multiple sessions', 2499, 150, 'eur', 12, 2, true),
  ('Premium Top-Up', 'premium-topup', 'Maximum savings — covers multiple programs and sessions', 6999, 500, 'eur', 12, 3, false)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  credit_value = EXCLUDED.credit_value,
  validity_months = EXCLUDED.validity_months;

-- Organization credit packages (corrected values)
-- Old values were wildly out of scale (3,000,000 credits for €25,000)
-- Org packages should serve teams of 5-50 people for 6-12 months
UPDATE public.org_credit_packages
SET credit_value = 2500, price_cents = 39900,
    description = 'Perfect for small teams getting started (5-10 members)'
WHERE slug = 'starter';

UPDATE public.org_credit_packages
SET credit_value = 7500, price_cents = 99900,
    description = 'Best value for growing teams (10-25 members)'
WHERE slug = 'growth';

UPDATE public.org_credit_packages
SET credit_value = 20000, price_cents = 249900,
    description = 'Maximum flexibility for large teams (25-50 members)'
WHERE slug = 'enterprise';

-- Insert if they don't exist yet (for fresh environments)
INSERT INTO public.org_credit_packages
  (name, slug, description, price_cents, credit_value, currency, validity_months, display_order)
VALUES
  ('Starter Package', 'starter', 'Perfect for small teams getting started (5-10 members)', 39900, 2500, 'eur', 12, 1),
  ('Growth Package', 'growth', 'Best value for growing teams (10-25 members)', 99900, 7500, 'eur', 12, 2),
  ('Enterprise Package', 'enterprise', 'Maximum flexibility for large teams (25-50 members)', 249900, 20000, 'eur', 12, 3)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  credit_value = EXCLUDED.credit_value;

-- Reset stripe_price_id on all packages since the prices changed
-- New Stripe products/prices will be auto-created on first purchase
UPDATE public.credit_topup_packages SET stripe_price_id = NULL;
UPDATE public.org_credit_packages SET stripe_price_id = NULL;
