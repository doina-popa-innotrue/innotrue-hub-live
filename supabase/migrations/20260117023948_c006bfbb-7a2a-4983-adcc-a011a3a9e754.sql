-- Update get_user_credit_summary_v2 to include program credits
CREATE OR REPLACE FUNCTION get_user_credit_summary_v2(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_allowance INTEGER := 0;
  v_period_start DATE;
  v_period_end DATE;
  v_period_usage INTEGER := 0;
  v_feature_allocations JSONB := '{}'::JSONB;
  v_feature_usage JSONB := '{}'::JSONB;
  v_bonus_batches JSONB := '[]'::JSONB;
  v_bonus_total INTEGER := 0;
  v_bonus_expiring_soon INTEGER := 0;
  v_earliest_expiry TIMESTAMPTZ;
  v_plan_name TEXT;
  v_plan_id UUID;
  -- Program credits
  v_program_total INTEGER := 0;
  v_program_used INTEGER := 0;
  v_program_remaining INTEGER := 0;
  v_program_details JSONB := '[]'::JSONB;
BEGIN
  -- Get current billing period
  SELECT bp.period_start, bp.period_end 
  INTO v_period_start, v_period_end
  FROM get_billing_period(p_user_id) bp;
  
  -- Get plan info and allowance
  SELECT p.id, p.name, COALESCE(p.credit_allowance, 0)
  INTO v_plan_id, v_plan_name, v_plan_allowance
  FROM user_subscriptions us
  JOIN plans p ON us.plan_id = p.id
  WHERE us.user_id = p_user_id
  AND us.status = 'active'
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- Get feature-specific allocations from plan
  SELECT COALESCE(jsonb_object_agg(pca.feature_key, pca.monthly_allocation), '{}'::JSONB)
  INTO v_feature_allocations
  FROM plan_credit_allocations pca
  WHERE pca.plan_id = v_plan_id;
  
  -- Get usage for current period (general)
  SELECT COALESCE(SUM(credits_used), 0)
  INTO v_period_usage
  FROM credit_usage_periods cup
  WHERE cup.owner_type = 'user'
  AND cup.owner_id = p_user_id
  AND cup.feature_key IS NULL
  AND cup.period_start = v_period_start;
  
  -- Get feature-specific usage for current period
  SELECT COALESCE(jsonb_object_agg(cup.feature_key, cup.credits_used), '{}'::JSONB)
  INTO v_feature_usage
  FROM credit_usage_periods cup
  WHERE cup.owner_type = 'user'
  AND cup.owner_id = p_user_id
  AND cup.feature_key IS NOT NULL
  AND cup.period_start = v_period_start;
  
  -- Get bonus/purchased credit batches (non-plan credits)
  SELECT 
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', cb.id,
      'feature_key', cb.feature_key,
      'remaining', cb.remaining_amount,
      'original', cb.original_amount,
      'expires_at', cb.expires_at,
      'source_type', cb.source_type,
      'description', cb.description
    ) ORDER BY cb.expires_at), '[]'::JSONB),
    COALESCE(SUM(cb.remaining_amount), 0),
    COALESCE(SUM(CASE WHEN cb.expires_at <= NOW() + INTERVAL '7 days' THEN cb.remaining_amount ELSE 0 END), 0),
    MIN(cb.expires_at)
  INTO v_bonus_batches, v_bonus_total, v_bonus_expiring_soon, v_earliest_expiry
  FROM credit_batches cb
  WHERE cb.owner_type = 'user'
  AND cb.owner_id = p_user_id
  AND cb.status IN ('active', 'partial')
  AND cb.remaining_amount > 0
  AND cb.source_type NOT IN ('plan_monthly');
  
  -- Get program entitlement credits (from active enrollments)
  SELECT 
    COALESCE(SUM(pe.quantity), 0),
    COALESCE(SUM(COALESCE(upeu.quantity_used, 0)), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'program_id', ce.program_id,
      'program_name', prog.name,
      'feature_key', f.key,
      'total', pe.quantity,
      'used', COALESCE(upeu.quantity_used, 0),
      'remaining', pe.quantity - COALESCE(upeu.quantity_used, 0)
    ) FILTER (WHERE pe.quantity > 0)), '[]'::JSONB)
  INTO v_program_total, v_program_used, v_program_details
  FROM client_enrollments ce
  JOIN programs prog ON ce.program_id = prog.id
  JOIN program_entitlements pe ON pe.program_id = ce.program_id
  JOIN features f ON pe.feature_id = f.id
  LEFT JOIN user_program_entitlement_usage upeu 
    ON upeu.user_id = p_user_id 
    AND upeu.entitlement_id = pe.id
  WHERE ce.client_user_id = p_user_id
  AND ce.status = 'active'
  AND (ce.end_date IS NULL OR ce.end_date >= CURRENT_DATE);
  
  v_program_remaining := GREATEST(0, v_program_total - v_program_used);
  
  RETURN jsonb_build_object(
    'plan_name', v_plan_name,
    'plan_allowance', v_plan_allowance,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'period_usage', v_period_usage,
    'plan_remaining', GREATEST(0, v_plan_allowance - v_period_usage),
    'feature_allocations', v_feature_allocations,
    'feature_usage', v_feature_usage,
    -- Program credits
    'program_total', v_program_total,
    'program_used', v_program_used,
    'program_remaining', v_program_remaining,
    'program_details', v_program_details,
    -- Bonus credits
    'bonus_credits', v_bonus_total,
    'bonus_batches', v_bonus_batches,
    'expiring_soon', v_bonus_expiring_soon,
    'earliest_expiry', v_earliest_expiry,
    -- Totals
    'total_available', GREATEST(0, v_plan_allowance - v_period_usage) + v_program_remaining + v_bonus_total
  );
END;
$$;

-- Update consume_credits_fifo to also consume from program entitlements
CREATE OR REPLACE FUNCTION consume_credits_fifo(
  p_owner_type TEXT,
  p_owner_id UUID,
  p_amount INTEGER,
  p_feature_key TEXT DEFAULT NULL,
  p_action_type TEXT DEFAULT 'general',
  p_action_reference_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_plan_allowance INTEGER := 0;
  v_feature_allocation INTEGER := 0;
  v_period_usage INTEGER := 0;
  v_feature_usage INTEGER := 0;
  v_plan_available INTEGER := 0;
  v_program_available INTEGER := 0;
  v_bonus_available INTEGER := 0;
  v_total_available INTEGER := 0;
  v_remaining_to_consume INTEGER;
  v_from_plan INTEGER := 0;
  v_from_program INTEGER := 0;
  v_from_bonus INTEGER := 0;
  v_batch RECORD;
  v_entitlement RECORD;
  v_batch_consume INTEGER;
  v_batches_used JSONB := '[]'::JSONB;
  v_plan_id UUID;
  v_feature_id UUID;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;
  
  -- Get feature ID if feature_key provided
  IF p_feature_key IS NOT NULL THEN
    SELECT id INTO v_feature_id FROM features WHERE key = p_feature_key;
  END IF;
  
  -- Get billing period
  IF p_owner_type = 'user' THEN
    SELECT bp.period_start, bp.period_end 
    INTO v_period_start, v_period_end
    FROM get_billing_period(p_owner_id) bp;
    
    -- Get plan allowance
    SELECT p.id, COALESCE(p.credit_allowance, 0)
    INTO v_plan_id, v_plan_allowance
    FROM user_subscriptions us
    JOIN plans p ON us.plan_id = p.id
    WHERE us.user_id = p_owner_id AND us.status = 'active'
    ORDER BY us.created_at DESC LIMIT 1;
    
    -- Get feature-specific allocation if applicable
    IF p_feature_key IS NOT NULL AND v_plan_id IS NOT NULL THEN
      SELECT COALESCE(pca.monthly_allocation, 0)
      INTO v_feature_allocation
      FROM plan_credit_allocations pca
      WHERE pca.plan_id = v_plan_id AND pca.feature_key = p_feature_key;
    END IF;
  ELSE
    -- Org: use current month
    v_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    v_period_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    
    -- Get org plan allowance
    SELECT COALESCE(p.credit_allowance, 0)
    INTO v_plan_allowance
    FROM organization_subscriptions os
    JOIN plans p ON os.plan_id = p.id
    WHERE os.organization_id = p_owner_id AND os.status = 'active'
    ORDER BY os.created_at DESC LIMIT 1;
  END IF;
  
  -- Get current period usage
  SELECT COALESCE(credits_used, 0) INTO v_period_usage
  FROM credit_usage_periods
  WHERE owner_type = p_owner_type
  AND owner_id = p_owner_id
  AND feature_key IS NULL
  AND period_start = v_period_start;
  
  -- Get feature-specific usage if applicable
  IF p_feature_key IS NOT NULL THEN
    SELECT COALESCE(credits_used, 0) INTO v_feature_usage
    FROM credit_usage_periods
    WHERE owner_type = p_owner_type
    AND owner_id = p_owner_id
    AND feature_key = p_feature_key
    AND period_start = v_period_start;
  END IF;
  
  -- Calculate available from plan
  IF p_feature_key IS NOT NULL AND v_feature_allocation > 0 THEN
    v_plan_available := GREATEST(0, v_feature_allocation - v_feature_usage);
  ELSE
    v_plan_available := GREATEST(0, v_plan_allowance - v_period_usage);
  END IF;
  
  -- Calculate available from program entitlements (user only)
  IF p_owner_type = 'user' AND v_feature_id IS NOT NULL THEN
    SELECT COALESCE(SUM(pe.quantity - COALESCE(upeu.quantity_used, 0)), 0)
    INTO v_program_available
    FROM client_enrollments ce
    JOIN program_entitlements pe ON pe.program_id = ce.program_id
    LEFT JOIN user_program_entitlement_usage upeu 
      ON upeu.user_id = p_owner_id 
      AND upeu.entitlement_id = pe.id
    WHERE ce.client_user_id = p_owner_id
    AND ce.status = 'active'
    AND pe.feature_id = v_feature_id
    AND (ce.end_date IS NULL OR ce.end_date >= CURRENT_DATE)
    AND pe.quantity > COALESCE(upeu.quantity_used, 0);
  END IF;
  
  -- Calculate available from bonus batches
  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_bonus_available
  FROM credit_batches
  WHERE owner_type = p_owner_type
  AND owner_id = p_owner_id
  AND status IN ('active', 'partial')
  AND remaining_amount > 0
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (feature_key IS NULL OR feature_key = p_feature_key)
  AND source_type NOT IN ('plan_monthly');
  
  v_total_available := v_plan_available + v_program_available + v_bonus_available;
  
  -- Check if we have enough
  IF v_total_available < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'available', v_total_available,
      'required', p_amount,
      'breakdown', jsonb_build_object(
        'plan', v_plan_available,
        'program', v_program_available,
        'bonus', v_bonus_available
      )
    );
  END IF;
  
  v_remaining_to_consume := p_amount;
  
  -- Priority 1: Consume from plan allowance (virtual credits)
  IF v_plan_available > 0 AND v_remaining_to_consume > 0 THEN
    v_from_plan := LEAST(v_remaining_to_consume, v_plan_available);
    v_remaining_to_consume := v_remaining_to_consume - v_from_plan;
    
    -- Update usage tracking
    IF p_feature_key IS NOT NULL AND v_feature_allocation > 0 THEN
      INSERT INTO credit_usage_periods (owner_type, owner_id, feature_key, period_start, period_end, credits_used)
      VALUES (p_owner_type, p_owner_id, p_feature_key, v_period_start, v_period_end, v_from_plan)
      ON CONFLICT (owner_type, owner_id, feature_key, period_start)
      DO UPDATE SET credits_used = credit_usage_periods.credits_used + v_from_plan, updated_at = NOW();
    ELSE
      INSERT INTO credit_usage_periods (owner_type, owner_id, feature_key, period_start, period_end, credits_used)
      VALUES (p_owner_type, p_owner_id, NULL, v_period_start, v_period_end, v_from_plan)
      ON CONFLICT (owner_type, owner_id, feature_key, period_start)
      DO UPDATE SET credits_used = credit_usage_periods.credits_used + v_from_plan, updated_at = NOW();
    END IF;
  END IF;
  
  -- Priority 2: Consume from program entitlements
  IF v_program_available > 0 AND v_remaining_to_consume > 0 AND p_owner_type = 'user' AND v_feature_id IS NOT NULL THEN
    FOR v_entitlement IN 
      SELECT pe.id, pe.quantity, COALESCE(upeu.quantity_used, 0) as used
      FROM client_enrollments ce
      JOIN program_entitlements pe ON pe.program_id = ce.program_id
      LEFT JOIN user_program_entitlement_usage upeu 
        ON upeu.user_id = p_owner_id 
        AND upeu.entitlement_id = pe.id
      WHERE ce.client_user_id = p_owner_id
      AND ce.status = 'active'
      AND pe.feature_id = v_feature_id
      AND (ce.end_date IS NULL OR ce.end_date >= CURRENT_DATE)
      AND pe.quantity > COALESCE(upeu.quantity_used, 0)
      ORDER BY ce.start_date -- FIFO by enrollment start
    LOOP
      EXIT WHEN v_remaining_to_consume <= 0;
      
      DECLARE
        v_entitlement_available INTEGER := v_entitlement.quantity - v_entitlement.used;
        v_consume_amount INTEGER := LEAST(v_remaining_to_consume, v_entitlement_available);
      BEGIN
        v_from_program := v_from_program + v_consume_amount;
        v_remaining_to_consume := v_remaining_to_consume - v_consume_amount;
        
        -- Update program entitlement usage
        INSERT INTO user_program_entitlement_usage (user_id, entitlement_id, quantity_used)
        VALUES (p_owner_id, v_entitlement.id, v_consume_amount)
        ON CONFLICT (user_id, entitlement_id)
        DO UPDATE SET quantity_used = user_program_entitlement_usage.quantity_used + v_consume_amount;
      END;
    END LOOP;
  END IF;
  
  -- Priority 3: Consume from bonus batches (FIFO by expiration)
  IF v_remaining_to_consume > 0 THEN
    FOR v_batch IN 
      SELECT id, remaining_amount
      FROM credit_batches
      WHERE owner_type = p_owner_type
      AND owner_id = p_owner_id
      AND status IN ('active', 'partial')
      AND remaining_amount > 0
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (feature_key IS NULL OR feature_key = p_feature_key)
      AND source_type NOT IN ('plan_monthly')
      ORDER BY expires_at NULLS LAST, created_at
    LOOP
      EXIT WHEN v_remaining_to_consume <= 0;
      
      v_batch_consume := LEAST(v_remaining_to_consume, v_batch.remaining_amount);
      v_from_bonus := v_from_bonus + v_batch_consume;
      v_remaining_to_consume := v_remaining_to_consume - v_batch_consume;
      
      -- Update batch
      UPDATE credit_batches
      SET remaining_amount = remaining_amount - v_batch_consume,
          status = CASE WHEN remaining_amount - v_batch_consume <= 0 THEN 'depleted' ELSE 'partial' END,
          updated_at = NOW()
      WHERE id = v_batch.id;
      
      v_batches_used := v_batches_used || jsonb_build_object('batch_id', v_batch.id, 'amount', v_batch_consume);
    END LOOP;
  END IF;
  
  -- Log the transaction
  INSERT INTO user_credit_transactions (
    user_id, transaction_type, credits, description, reference_id, batch_id
  ) VALUES (
    CASE WHEN p_owner_type = 'user' THEN p_owner_id ELSE NULL END,
    'debit',
    -p_amount,
    COALESCE(p_description, p_action_type),
    p_action_reference_id,
    CASE WHEN jsonb_array_length(v_batches_used) > 0 
         THEN (v_batches_used->0->>'batch_id')::UUID 
         ELSE NULL END
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'consumed', p_amount,
    'from_plan', v_from_plan,
    'from_program', v_from_program,
    'from_bonus', v_from_bonus,
    'balance_after', v_total_available - p_amount,
    'batches_used', v_batches_used
  );
END;
$$;