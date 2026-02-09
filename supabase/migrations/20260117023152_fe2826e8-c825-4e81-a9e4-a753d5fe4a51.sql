-- Create a view/function for tracking usage per billing period
-- First, let's add a table to track credit consumption (simpler than parsing transactions)
CREATE TABLE IF NOT EXISTS credit_usage_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'org')),
  owner_id UUID NOT NULL,
  feature_key TEXT, -- NULL = general usage
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_type, owner_id, feature_key, period_start)
);

-- Enable RLS
ALTER TABLE credit_usage_periods ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own credit usage"
  ON credit_usage_periods FOR SELECT
  USING (owner_type = 'user' AND owner_id = auth.uid());

-- Org members can view org usage
CREATE POLICY "Org members can view org credit usage"
  ON credit_usage_periods FOR SELECT
  USING (
    owner_type = 'org' AND 
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = credit_usage_periods.owner_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Admins can view all
CREATE POLICY "Admins can view all credit usage"
  ON credit_usage_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Index for fast lookups
CREATE INDEX idx_credit_usage_periods_lookup 
  ON credit_usage_periods(owner_type, owner_id, period_start, period_end);

-- Helper function to get current billing period for a user
CREATE OR REPLACE FUNCTION get_billing_period(p_user_id UUID)
RETURNS TABLE(period_start DATE, period_end DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_start DATE;
  v_today DATE := CURRENT_DATE;
  v_months_elapsed INTEGER;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Get subscription start date
  SELECT DATE(us.created_at)
  INTO v_sub_start
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  AND us.status = 'active'
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- Default to first of current month if no subscription
  IF v_sub_start IS NULL THEN
    v_period_start := DATE_TRUNC('month', v_today)::DATE;
    v_period_end := (DATE_TRUNC('month', v_today) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  ELSE
    -- Calculate which billing period we're in
    v_months_elapsed := (EXTRACT(YEAR FROM v_today) - EXTRACT(YEAR FROM v_sub_start)) * 12 
                       + (EXTRACT(MONTH FROM v_today) - EXTRACT(MONTH FROM v_sub_start));
    
    -- Adjust if we haven't reached the billing day yet this month
    IF EXTRACT(DAY FROM v_today) < EXTRACT(DAY FROM v_sub_start) THEN
      v_months_elapsed := v_months_elapsed - 1;
    END IF;
    
    v_period_start := (v_sub_start + (v_months_elapsed || ' months')::INTERVAL)::DATE;
    v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  END IF;
  
  RETURN QUERY SELECT v_period_start, v_period_end;
END;
$$;

-- New lazy calculation function for user credit summary
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
  AND cb.source_type NOT IN ('plan_monthly'); -- Exclude old plan-granted batches
  
  RETURN jsonb_build_object(
    'plan_name', v_plan_name,
    'plan_allowance', v_plan_allowance,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'period_usage', v_period_usage,
    'plan_remaining', GREATEST(0, v_plan_allowance - v_period_usage),
    'feature_allocations', v_feature_allocations,
    'feature_usage', v_feature_usage,
    'bonus_credits', v_bonus_total,
    'bonus_batches', v_bonus_batches,
    'expiring_soon', v_bonus_expiring_soon,
    'earliest_expiry', v_earliest_expiry,
    'total_available', GREATEST(0, v_plan_allowance - v_period_usage) + v_bonus_total
  );
END;
$$;

-- New lazy consumption function
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
  v_bonus_available INTEGER := 0;
  v_total_available INTEGER := 0;
  v_remaining_to_consume INTEGER;
  v_from_plan INTEGER := 0;
  v_from_bonus INTEGER := 0;
  v_batch RECORD;
  v_batch_consume INTEGER;
  v_batches_used JSONB := '[]'::JSONB;
  v_plan_id UUID;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
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
    -- Feature-specific credits first
    v_plan_available := GREATEST(0, v_feature_allocation - v_feature_usage);
  ELSE
    -- General plan credits
    v_plan_available := GREATEST(0, v_plan_allowance - v_period_usage);
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
  
  v_total_available := v_plan_available + v_bonus_available;
  
  -- Check if we have enough
  IF v_total_available < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'available', v_total_available,
      'required', p_amount
    );
  END IF;
  
  v_remaining_to_consume := p_amount;
  
  -- First, consume from plan allowance (virtual credits)
  IF v_plan_available > 0 THEN
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
  
  -- Then, consume from bonus batches (FIFO by expiration)
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
    'from_bonus', v_from_bonus,
    'balance_after', v_total_available - p_amount,
    'batches_used', v_batches_used
  );
END;
$$;

-- Update org summary to use lazy calculation too
CREATE OR REPLACE FUNCTION get_org_credit_summary_v2(p_org_id UUID)
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
  v_bonus_total INTEGER := 0;
  v_bonus_expiring_soon INTEGER := 0;
  v_earliest_expiry TIMESTAMPTZ;
  v_plan_name TEXT;
  v_bonus_batches JSONB;
BEGIN
  -- Use current month for orgs
  v_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_period_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Get plan info
  SELECT p.name, COALESCE(p.credit_allowance, 0)
  INTO v_plan_name, v_plan_allowance
  FROM organization_subscriptions os
  JOIN plans p ON os.plan_id = p.id
  WHERE os.organization_id = p_org_id AND os.status = 'active'
  ORDER BY os.created_at DESC LIMIT 1;
  
  -- Get usage
  SELECT COALESCE(SUM(credits_used), 0) INTO v_period_usage
  FROM credit_usage_periods
  WHERE owner_type = 'org' AND owner_id = p_org_id
  AND period_start = v_period_start;
  
  -- Get bonus batches
  SELECT 
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', cb.id, 'remaining', cb.remaining_amount, 'expires_at', cb.expires_at
    )), '[]'::JSONB),
    COALESCE(SUM(cb.remaining_amount), 0),
    COALESCE(SUM(CASE WHEN cb.expires_at <= NOW() + INTERVAL '7 days' THEN cb.remaining_amount ELSE 0 END), 0),
    MIN(cb.expires_at)
  INTO v_bonus_batches, v_bonus_total, v_bonus_expiring_soon, v_earliest_expiry
  FROM credit_batches cb
  WHERE cb.owner_type = 'org' AND cb.owner_id = p_org_id
  AND cb.status IN ('active', 'partial') AND cb.remaining_amount > 0
  AND cb.source_type NOT IN ('plan_monthly');
  
  RETURN jsonb_build_object(
    'plan_name', v_plan_name,
    'plan_allowance', v_plan_allowance,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'period_usage', v_period_usage,
    'plan_remaining', GREATEST(0, v_plan_allowance - v_period_usage),
    'bonus_credits', v_bonus_total,
    'bonus_batches', v_bonus_batches,
    'expiring_soon', v_bonus_expiring_soon,
    'earliest_expiry', v_earliest_expiry,
    'total_available', GREATEST(0, v_plan_allowance - v_period_usage) + v_bonus_total
  );
END;
$$;