-- 2B.13 Credit Expiry Policy: Change purchased credit expiry from 12 months → configurable (default 10 years)
-- All code paths use system_settings.purchased_credit_expiry_months as single source of truth.
-- Applies to: purchased credits, admin grants, add-on credits — anything the client bought on top of plan allocations.
-- Plan credits (virtual monthly pool) are unaffected — they reset monthly regardless.

-- Step 1: Add system_settings key for purchased credit expiry (months)
INSERT INTO system_settings (key, value, description)
VALUES (
  'purchased_credit_expiry_months',
  '120',
  'Months until purchased/granted/addon credits expire. Default 120 (10 years). '
  'Applies to anything the client purchased on top of plan allocations: '
  'credit top-ups, admin grants, add-on credits. '
  'Plan credits reset monthly regardless of this setting.'
)
ON CONFLICT (key) DO NOTHING;

-- Step 2: Update credit_source_types defaults (used by BulkCreditGrantDialog)
UPDATE credit_source_types SET default_expiry_months = 120 WHERE key IN ('purchase', 'admin_grant', 'addon');

-- Step 3: Update package validity_months to match system setting
UPDATE credit_topup_packages SET validity_months = 120 WHERE validity_months = 12;
UPDATE org_credit_packages SET validity_months = 120 WHERE validity_months = 12;

-- Step 4: Retroactively extend existing purchased/granted/addon batches
-- Uses PL/pgSQL to read from system_settings dynamically (no hardcoded values)
DO $$
DECLARE
  v_months integer;
BEGIN
  SELECT value::integer INTO v_months
  FROM system_settings
  WHERE key = 'purchased_credit_expiry_months';

  v_months := COALESCE(v_months, 120);

  UPDATE credit_batches
  SET expires_at = granted_at + (v_months || ' months')::interval,
      updated_at = now()
  WHERE source_type IN ('purchase', 'admin_grant', 'addon')
    AND NOT is_expired
    AND remaining_amount > 0
    AND expires_at < granted_at + (v_months || ' months')::interval;
END;
$$;
