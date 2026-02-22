-- =============================================================================
-- 2B.3: Pricing Update — €49/99/179/249 monthly, annual 20% discount, ~2x credits
-- =============================================================================

-- 1. Update monthly prices (NULL stripe_price_id forces new Stripe price auto-creation)
UPDATE public.plan_prices SET price_cents = 4900, stripe_price_id = NULL, updated_at = now()
WHERE plan_id = (SELECT id FROM plans WHERE key = 'base') AND billing_interval = 'month';

UPDATE public.plan_prices SET price_cents = 9900, stripe_price_id = NULL, updated_at = now()
WHERE plan_id = (SELECT id FROM plans WHERE key = 'pro') AND billing_interval = 'month';

UPDATE public.plan_prices SET price_cents = 17900, stripe_price_id = NULL, updated_at = now()
WHERE plan_id = (SELECT id FROM plans WHERE key = 'advanced') AND billing_interval = 'month';

UPDATE public.plan_prices SET price_cents = 24900, stripe_price_id = NULL, updated_at = now()
WHERE plan_id = (SELECT id FROM plans WHERE key = 'elite') AND billing_interval = 'month';

-- 2. Add annual prices (20% discount) — upsert in case they already exist
-- base: €49/mo → €470/yr (€39.17/mo effective)
INSERT INTO public.plan_prices (plan_id, billing_interval, price_cents, is_default)
SELECT id, 'year', 47000, false FROM plans WHERE key = 'base'
ON CONFLICT (plan_id, billing_interval) DO UPDATE SET price_cents = 47000, stripe_price_id = NULL, updated_at = now();

-- pro: €99/mo → €950/yr (€79.17/mo effective)
INSERT INTO public.plan_prices (plan_id, billing_interval, price_cents, is_default)
SELECT id, 'year', 95000, false FROM plans WHERE key = 'pro'
ON CONFLICT (plan_id, billing_interval) DO UPDATE SET price_cents = 95000, stripe_price_id = NULL, updated_at = now();

-- advanced: €179/mo → €1718/yr (€143.17/mo effective)
INSERT INTO public.plan_prices (plan_id, billing_interval, price_cents, is_default)
SELECT id, 'year', 171800, false FROM plans WHERE key = 'advanced'
ON CONFLICT (plan_id, billing_interval) DO UPDATE SET price_cents = 171800, stripe_price_id = NULL, updated_at = now();

-- elite: €249/mo → €2390/yr (€199.17/mo effective)
INSERT INTO public.plan_prices (plan_id, billing_interval, price_cents, is_default)
SELECT id, 'year', 239000, false FROM plans WHERE key = 'elite'
ON CONFLICT (plan_id, billing_interval) DO UPDATE SET price_cents = 239000, stripe_price_id = NULL, updated_at = now();

-- 3. Scale credit allowances ~2x
UPDATE public.plans SET credit_allowance = 300, updated_at = now() WHERE key = 'base';
UPDATE public.plans SET credit_allowance = 500, updated_at = now() WHERE key = 'pro';
UPDATE public.plans SET credit_allowance = 1000, updated_at = now() WHERE key = 'advanced';
UPDATE public.plans SET credit_allowance = 1500, updated_at = now() WHERE key = 'elite';
-- free stays at 20

-- 4. Deprecate continuation plan (replaced by alumni lifecycle)
UPDATE public.plans SET is_active = false, updated_at = now() WHERE key = 'continuation';
