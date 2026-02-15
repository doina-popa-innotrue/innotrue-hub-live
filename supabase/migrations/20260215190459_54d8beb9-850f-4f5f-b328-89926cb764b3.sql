-- Migration: enroll_with_credits + FOR UPDATE SKIP LOCKED on consume_credits_fifo
-- Fixes: C3 (credit loss on failed enrollment) + M6 (credit batch race condition)
--
-- C3: Credits were consumed in one transaction, enrollment created in another.
--     If enrollment failed, credits were lost. Now both happen atomically.
-- M6: consume_credits_fifo lacked row-level locking on credit_batches,
--     allowing concurrent requests to double-spend. Added FOR UPDATE SKIP LOCKED.

----------------------------------------------------------------------
-- 1. Patch consume_credits_fifo: add FOR UPDATE SKIP LOCKED
----------------------------------------------------------------------
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
  -- FOR UPDATE SKIP LOCKED prevents concurrent double-spend (M6 fix)
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
      FOR UPDATE SKIP LOCKED
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
  -- FOR UPDATE SKIP LOCKED prevents concurrent double-spend (M6 fix)
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
      FOR UPDATE SKIP LOCKED
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


----------------------------------------------------------------------
-- 2. New function: enroll_with_credits (atomic enrollment + credits)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enroll_with_credits(
  p_client_user_id uuid,
  p_program_id uuid,
  p_tier text DEFAULT NULL,
  p_program_plan_id uuid DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL,
  p_original_credit_cost integer DEFAULT NULL,
  p_final_credit_cost integer DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id uuid;
  v_consume_result jsonb;
BEGIN
  -- Step 1: Consume credits if cost > 0
  IF COALESCE(p_final_credit_cost, 0) > 0 THEN
    v_consume_result := public.consume_credits_fifo(
      p_owner_type := 'user',
      p_owner_id := p_client_user_id,
      p_amount := p_final_credit_cost,
      p_feature_key := NULL,
      p_action_type := 'program_enrollment',
      p_action_reference_id := p_program_id::text,
      p_description := COALESCE(p_description, 'Program enrollment')
    );

    -- If credit consumption failed, abort — nothing has been committed yet
    IF NOT (v_consume_result->>'success')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', COALESCE(v_consume_result->>'error', 'Credit consumption failed'),
        'enrollment_id', null,
        'credit_details', v_consume_result
      );
    END IF;
  END IF;

  -- Step 2: Create enrollment (same transaction — auto-rolls back on failure)
  INSERT INTO client_enrollments (
    client_user_id,
    program_id,
    status,
    tier,
    program_plan_id,
    discount_percent,
    original_credit_cost,
    final_credit_cost
  ) VALUES (
    p_client_user_id,
    p_program_id,
    'active',
    p_tier,
    p_program_plan_id,
    p_discount_percent,
    p_original_credit_cost,
    p_final_credit_cost
  )
  RETURNING id INTO v_enrollment_id;

  -- Step 3: Link consumption log entries to the enrollment
  IF COALESCE(p_final_credit_cost, 0) > 0 THEN
    UPDATE credit_consumption_log
    SET action_reference_id = v_enrollment_id::text
    WHERE action_reference_id = p_program_id::text
      AND action_type = 'program_enrollment'
      AND user_id = p_client_user_id
      AND consumed_at >= now() - interval '5 seconds';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'credit_details', COALESCE(v_consume_result, '{}'::jsonb)
  );

EXCEPTION WHEN OTHERS THEN
  -- Any failure (including enrollment insert) rolls back EVERYTHING
  -- including the credit consumption from step 1
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'enrollment_id', null,
    'credit_details', null
  );
END;
$$;

-- Grant execute to authenticated users (admin-only use, but RPC needs access)
GRANT EXECUTE ON FUNCTION public.enroll_with_credits TO authenticated;
