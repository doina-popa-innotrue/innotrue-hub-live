-- Update consume_credits_fifo and get_user_credit_summary_v2 to include admin_grant as a valid source_type

-- Update the check constraint on credit_batches to allow admin_grant
ALTER TABLE credit_batches DROP CONSTRAINT IF EXISTS credit_batches_source_type_check;
ALTER TABLE credit_batches ADD CONSTRAINT credit_batches_source_type_check 
  CHECK (source_type IN ('subscription', 'purchase', 'grant', 'rollover', 'plan', 'program', 'addon', 'admin_grant'));

-- Fix get_user_credit_summary_v2 to include admin_grant in bonus credits
CREATE OR REPLACE FUNCTION public.get_user_credit_summary_v2(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_plan_name text;
  v_plan_allowance integer := 0;
  v_period_start timestamptz;
  v_period_usage integer := 0;
  v_plan_remaining integer := 0;
  v_program_total integer := 0;
  v_program_used integer := 0;
  v_program_remaining integer := 0;
  v_bonus_credits integer := 0;
  v_total_available integer := 0;
  v_feature_allocations jsonb := '{}'::jsonb;
  v_feature_usage jsonb := '{}'::jsonb;
  v_program_details jsonb := '[]'::jsonb;
  v_bonus_batches jsonb := '[]'::jsonb;
BEGIN
  -- Get user's plan from profiles table
  SELECT pr.plan_id, p.name, COALESCE(p.credit_allowance, 0)
  INTO v_plan_id, v_plan_name, v_plan_allowance
  FROM profiles pr
  LEFT JOIN plans p ON pr.plan_id = p.id
  WHERE pr.id = p_user_id;

  -- Calculate period start (first of current month)
  v_period_start := date_trunc('month', now());

  -- Get period usage from credit_consumption_log
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_period_usage
  FROM credit_consumption_log
  WHERE user_id = p_user_id
    AND consumed_at >= v_period_start
    AND source_type = 'plan';

  -- Calculate plan remaining
  v_plan_remaining := GREATEST(0, v_plan_allowance - v_period_usage);

  -- Get feature-specific allocations
  SELECT COALESCE(jsonb_object_agg(pca.feature_key, pca.monthly_allocation), '{}'::jsonb)
  INTO v_feature_allocations
  FROM plan_credit_allocations pca
  WHERE pca.plan_id = v_plan_id;

  -- Get feature-specific usage
  SELECT COALESCE(jsonb_object_agg(feature_key, usage_count), '{}'::jsonb)
  INTO v_feature_usage
  FROM (
    SELECT feature_key, SUM(quantity) as usage_count
    FROM credit_consumption_log
    WHERE user_id = p_user_id
      AND consumed_at >= v_period_start
      AND feature_key IS NOT NULL
    GROUP BY feature_key
  ) fu;

  -- Get program credits from credit_batches
  SELECT 
    COALESCE(SUM(cb.original_amount), 0),
    COALESCE(SUM(cb.original_amount - cb.remaining_amount), 0),
    COALESCE(SUM(cb.remaining_amount), 0)
  INTO v_program_total, v_program_used, v_program_remaining
  FROM credit_batches cb
  WHERE cb.owner_type = 'user'
    AND cb.owner_id = p_user_id
    AND cb.source_type = 'program'
    AND cb.is_expired = false
    AND (cb.expires_at IS NULL OR cb.expires_at > now());

  -- Get program details
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'batch_id', cb.id,
    'feature_key', cb.feature_key,
    'total', cb.original_amount,
    'used', cb.original_amount - cb.remaining_amount,
    'remaining', cb.remaining_amount,
    'expires_at', cb.expires_at
  )), '[]'::jsonb)
  INTO v_program_details
  FROM credit_batches cb
  WHERE cb.owner_type = 'user'
    AND cb.owner_id = p_user_id
    AND cb.source_type = 'program'
    AND cb.is_expired = false
    AND (cb.expires_at IS NULL OR cb.expires_at > now());

  -- Get bonus credits (add-ons, purchases, grants, admin_grant)
  SELECT COALESCE(SUM(cb.remaining_amount), 0)
  INTO v_bonus_credits
  FROM credit_batches cb
  WHERE cb.owner_type = 'user'
    AND cb.owner_id = p_user_id
    AND cb.source_type IN ('grant', 'purchase', 'addon', 'rollover', 'subscription', 'admin_grant')
    AND cb.is_expired = false
    AND (cb.expires_at IS NULL OR cb.expires_at > now());

  -- Get bonus batch details
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cb.id,
    'type', cb.source_type,
    'source', cb.description,
    'remaining', cb.remaining_amount,
    'original', cb.original_amount,
    'expires_at', cb.expires_at,
    'feature_key', cb.feature_key
  ) ORDER BY cb.expires_at NULLS LAST), '[]'::jsonb)
  INTO v_bonus_batches
  FROM credit_batches cb
  WHERE cb.owner_type = 'user'
    AND cb.owner_id = p_user_id
    AND cb.source_type IN ('grant', 'purchase', 'addon', 'rollover', 'subscription', 'admin_grant')
    AND cb.is_expired = false
    AND (cb.expires_at IS NULL OR cb.expires_at > now())
    AND cb.remaining_amount > 0;

  -- Calculate total available
  v_total_available := v_plan_remaining + v_program_remaining + v_bonus_credits;

  RETURN jsonb_build_object(
    'plan_id', v_plan_id,
    'plan_name', v_plan_name,
    'plan_allowance', v_plan_allowance,
    'period_start', v_period_start,
    'period_end', date_trunc('month', now()) + interval '1 month',
    'period_usage', v_period_usage,
    'plan_remaining', v_plan_remaining,
    'program_total', v_program_total,
    'program_used', v_program_used,
    'program_remaining', v_program_remaining,
    'program_details', v_program_details,
    'bonus_credits', v_bonus_credits,
    'bonus_batches', v_bonus_batches,
    'expiring_soon', (
      SELECT COALESCE(SUM(remaining_amount), 0)
      FROM credit_batches
      WHERE owner_type = 'user' AND owner_id = p_user_id
        AND is_expired = false
        AND expires_at IS NOT NULL
        AND expires_at <= now() + interval '7 days'
    ),
    'earliest_expiry', (
      SELECT MIN(expires_at)
      FROM credit_batches
      WHERE owner_type = 'user' AND owner_id = p_user_id
        AND is_expired = false
        AND remaining_amount > 0
    ),
    'total_available', v_total_available,
    'feature_allocations', v_feature_allocations,
    'feature_usage', v_feature_usage
  );
END;
$$;

-- Fix consume_credits_fifo to include admin_grant in bonus batch types
CREATE OR REPLACE FUNCTION public.consume_credits_fifo(
  p_owner_type text DEFAULT 'user',
  p_owner_id uuid DEFAULT NULL,
  p_amount integer DEFAULT 1,
  p_feature_key text DEFAULT NULL,
  p_action_type text DEFAULT 'consumption',
  p_action_reference_id text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_to_consume integer := p_amount;
  v_plan_id uuid;
  v_plan_allowance integer := 0;
  v_period_start timestamptz;
  v_period_usage integer := 0;
  v_plan_available integer := 0;
  v_plan_consumed integer := 0;
  v_batch record;
  v_batch_consume integer;
  v_total_consumed integer := 0;
  v_consumption_details jsonb := '[]'::jsonb;
  v_effective_owner_id uuid;
BEGIN
  -- Handle backward compatibility: if p_owner_id is null, use auth.uid()
  v_effective_owner_id := COALESCE(p_owner_id, auth.uid());
  
  IF v_effective_owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No user or organization ID provided',
      'consumed', 0
    );
  END IF;

  -- Validate quantity
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Quantity must be positive',
      'consumed', 0
    );
  END IF;

  -- Step 1: For users, try plan credits first
  IF p_owner_type = 'user' THEN
    -- Get user's plan from profiles table
    SELECT pr.plan_id, COALESCE(p.credit_allowance, 0)
    INTO v_plan_id, v_plan_allowance
    FROM profiles pr
    LEFT JOIN plans p ON pr.plan_id = p.id
    WHERE pr.id = v_effective_owner_id;

    -- Calculate period start (first of current month)
    v_period_start := date_trunc('month', now());

    -- Get period usage
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_period_usage
    FROM credit_consumption_log
    WHERE user_id = v_effective_owner_id
      AND consumed_at >= v_period_start
      AND source_type = 'plan';

    -- Calculate plan available
    v_plan_available := GREATEST(0, v_plan_allowance - v_period_usage);

    -- Consume from plan credits first
    IF v_remaining_to_consume > 0 AND v_plan_available > 0 THEN
      v_plan_consumed := LEAST(v_remaining_to_consume, v_plan_available);
      v_remaining_to_consume := v_remaining_to_consume - v_plan_consumed;
      v_total_consumed := v_total_consumed + v_plan_consumed;

      -- Log plan consumption
      INSERT INTO credit_consumption_log (
        user_id, quantity, source_type, batch_id, feature_key, 
        action_type, action_reference_id, description, consumed_at
      ) VALUES (
        v_effective_owner_id, v_plan_consumed, 'plan', v_plan_id, p_feature_key,
        p_action_type, p_action_reference_id, p_description, now()
      );

      v_consumption_details := v_consumption_details || jsonb_build_object(
        'source', 'plan',
        'amount', v_plan_consumed
      );
    END IF;
  END IF;

  -- Step 2: Consume from program batches (FIFO by expiry) - users only
  IF v_remaining_to_consume > 0 AND p_owner_type = 'user' THEN
    FOR v_batch IN
      SELECT id, original_amount, remaining_amount
      FROM credit_batches
      WHERE owner_type = 'user'
        AND owner_id = v_effective_owner_id
        AND source_type = 'program'
        AND is_expired = false
        AND (expires_at IS NULL OR expires_at > now())
        AND remaining_amount > 0
        AND (feature_key IS NULL OR feature_key = p_feature_key)
      ORDER BY expires_at NULLS LAST, created_at
    LOOP
      EXIT WHEN v_remaining_to_consume <= 0;
      
      v_batch_consume := LEAST(v_remaining_to_consume, v_batch.remaining_amount);
      v_remaining_to_consume := v_remaining_to_consume - v_batch_consume;
      v_total_consumed := v_total_consumed + v_batch_consume;

      -- Update batch
      UPDATE credit_batches
      SET remaining_amount = remaining_amount - v_batch_consume,
          updated_at = now()
      WHERE id = v_batch.id;

      -- Log consumption
      INSERT INTO credit_consumption_log (
        user_id, quantity, source_type, batch_id, feature_key,
        action_type, action_reference_id, description, consumed_at
      ) VALUES (
        v_effective_owner_id, v_batch_consume, 'program', v_batch.id, p_feature_key,
        p_action_type, p_action_reference_id, p_description, now()
      );

      v_consumption_details := v_consumption_details || jsonb_build_object(
        'source', 'program',
        'batch_id', v_batch.id,
        'amount', v_batch_consume
      );
    END LOOP;
  END IF;

  -- Step 3: Consume from bonus batches (FIFO by expiry) - includes admin_grant
  IF v_remaining_to_consume > 0 THEN
    FOR v_batch IN
      SELECT id, original_amount, remaining_amount
      FROM credit_batches
      WHERE owner_type = p_owner_type
        AND owner_id = v_effective_owner_id
        AND source_type IN ('grant', 'purchase', 'addon', 'rollover', 'subscription', 'admin_grant')
        AND is_expired = false
        AND (expires_at IS NULL OR expires_at > now())
        AND remaining_amount > 0
      ORDER BY expires_at NULLS LAST, created_at
    LOOP
      EXIT WHEN v_remaining_to_consume <= 0;

      v_batch_consume := LEAST(v_remaining_to_consume, v_batch.remaining_amount);
      v_remaining_to_consume := v_remaining_to_consume - v_batch_consume;
      v_total_consumed := v_total_consumed + v_batch_consume;

      -- Update batch
      UPDATE credit_batches
      SET remaining_amount = remaining_amount - v_batch_consume,
          updated_at = now()
      WHERE id = v_batch.id;

      -- Log consumption
      IF p_owner_type = 'user' THEN
        INSERT INTO credit_consumption_log (
          user_id, quantity, source_type, batch_id, feature_key,
          action_type, action_reference_id, description, consumed_at
        ) VALUES (
          v_effective_owner_id, v_batch_consume, 'bonus', v_batch.id, p_feature_key,
          p_action_type, p_action_reference_id, p_description, now()
        );
      ELSE
        INSERT INTO credit_consumption_log (
          organization_id, quantity, source_type, batch_id, feature_key,
          action_type, action_reference_id, description, consumed_at
        ) VALUES (
          v_effective_owner_id, v_batch_consume, 'bonus', v_batch.id, p_feature_key,
          p_action_type, p_action_reference_id, p_description, now()
        );
      END IF;

      v_consumption_details := v_consumption_details || jsonb_build_object(
        'source', 'bonus',
        'batch_id', v_batch.id,
        'amount', v_batch_consume
      );
    END LOOP;
  END IF;

  -- Return result
  IF v_remaining_to_consume > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'requested', p_amount,
      'consumed', v_total_consumed,
      'remaining_needed', v_remaining_to_consume,
      'details', v_consumption_details
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'consumed', v_total_consumed,
    'from_plan', v_plan_consumed,
    'from_program', v_total_consumed - v_plan_consumed - (
      SELECT COALESCE(SUM((detail->>'amount')::integer), 0) 
      FROM jsonb_array_elements(v_consumption_details) detail 
      WHERE detail->>'source' = 'bonus'
    ),
    'from_bonus', (
      SELECT COALESCE(SUM((detail->>'amount')::integer), 0) 
      FROM jsonb_array_elements(v_consumption_details) detail 
      WHERE detail->>'source' = 'bonus'
    ),
    'details', v_consumption_details
  );
END;
$$;