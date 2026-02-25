-- Configurable credit-to-EUR ratio + atomic scaling RPC
-- Currently hardcoded at 2 credits = 1 EUR across 6+ frontend files.
-- This migration makes it a system setting and provides a tool to
-- proportionally scale all credit balances when the ratio changes.

-- Step 1: Insert system setting (default 2, matching current hardcoded value)
INSERT INTO system_settings (key, value, description)
VALUES (
  'credit_to_eur_ratio',
  '2',
  'Number of credits per 1 EUR (e.g. 2 means 2 credits = EUR 1). Use the Scale Credit Balances tool on the System Settings page to scale existing credits when changing this value.'
)
ON CONFLICT (key) DO NOTHING;

-- Step 2: Atomic credit scaling RPC
-- Scales all active credit batches, packages, plan allowances, and tier costs
-- when the credit-to-EUR ratio changes. Uses CEIL rounding (fair to users).
CREATE OR REPLACE FUNCTION public.scale_credit_batches(
  p_old_ratio NUMERIC,
  p_new_ratio NUMERIC,
  p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scale_factor NUMERIC;
  v_batches_affected INTEGER := 0;
  v_total_old_credits BIGINT := 0;
  v_total_new_credits BIGINT := 0;
  v_batch RECORD;
BEGIN
  -- Validate inputs
  IF p_old_ratio <= 0 OR p_new_ratio <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ratios must be positive numbers');
  END IF;

  IF p_old_ratio = p_new_ratio THEN
    RETURN jsonb_build_object('success', false, 'error', 'Old and new ratios are the same');
  END IF;

  v_scale_factor := p_new_ratio / p_old_ratio;

  -- Scale active, non-expired credit batches with remaining credits
  FOR v_batch IN
    SELECT id, remaining_amount, original_amount
    FROM credit_batches
    WHERE NOT is_expired
      AND remaining_amount > 0
    FOR UPDATE
  LOOP
    v_batches_affected := v_batches_affected + 1;
    v_total_old_credits := v_total_old_credits + v_batch.remaining_amount;

    UPDATE credit_batches
    SET remaining_amount = CEIL(v_batch.remaining_amount * v_scale_factor),
        original_amount = CEIL(v_batch.original_amount * v_scale_factor),
        updated_at = now()
    WHERE id = v_batch.id;

    v_total_new_credits := v_total_new_credits + CEIL(v_batch.remaining_amount * v_scale_factor);
  END LOOP;

  -- Scale active credit topup packages
  UPDATE credit_topup_packages
  SET credit_value = CEIL(credit_value * v_scale_factor)
  WHERE is_active = true;

  -- Scale active org credit packages
  UPDATE org_credit_packages
  SET credit_value = CEIL(credit_value * v_scale_factor)
  WHERE is_active = true;

  -- Scale plan credit allowances
  UPDATE plans
  SET credit_allowance = CEIL(credit_allowance * v_scale_factor)
  WHERE credit_allowance IS NOT NULL AND credit_allowance > 0;

  -- Scale program plan credit allowances
  UPDATE program_plans
  SET credit_allowance = CEIL(credit_allowance * v_scale_factor)
  WHERE credit_allowance IS NOT NULL AND credit_allowance > 0;

  -- Scale program tier credit costs
  UPDATE program_tier_plans
  SET credit_cost = CEIL(credit_cost * v_scale_factor)
  WHERE credit_cost IS NOT NULL AND credit_cost > 0;

  -- Update the system_settings value
  UPDATE system_settings
  SET value = p_new_ratio::text
  WHERE key = 'credit_to_eur_ratio';

  -- Log to admin_audit_logs
  INSERT INTO admin_audit_logs (
    admin_user_id, action, entity_type, entity_id,
    old_values, new_values
  ) VALUES (
    p_admin_user_id,
    'credit_ratio_scale',
    'system_settings',
    NULL,
    jsonb_build_object(
      'old_ratio', p_old_ratio,
      'batches_affected', v_batches_affected,
      'total_old_credits', v_total_old_credits
    ),
    jsonb_build_object(
      'new_ratio', p_new_ratio,
      'scale_factor', v_scale_factor,
      'total_new_credits', v_total_new_credits,
      'rounding_method', 'CEIL'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'batches_affected', v_batches_affected,
    'total_old_credits', v_total_old_credits,
    'total_new_credits', v_total_new_credits,
    'scale_factor', v_scale_factor
  );
END;
$$;
