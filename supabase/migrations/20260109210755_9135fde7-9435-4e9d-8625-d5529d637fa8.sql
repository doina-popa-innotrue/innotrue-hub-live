-- Create table to track plan credit rollovers
CREATE TABLE public.plan_credit_rollovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_key TEXT NOT NULL,
  rollover_credits INTEGER NOT NULL DEFAULT 0,
  last_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, feature_key)
);

-- Enable RLS
ALTER TABLE public.plan_credit_rollovers ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rollovers
CREATE POLICY "Users can view own rollovers"
  ON public.plan_credit_rollovers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Function to calculate and apply rollover at period boundary
CREATE OR REPLACE FUNCTION public.calculate_plan_rollover(
  p_user_id UUID,
  p_feature_key TEXT,
  p_plan_limit INTEGER,
  p_current_used INTEGER,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_rollover RECORD;
  v_unused_credits INTEGER;
  v_new_rollover INTEGER;
  v_total_rollover INTEGER;
BEGIN
  -- Get existing rollover record
  SELECT * INTO v_existing_rollover
  FROM plan_credit_rollovers
  WHERE user_id = p_user_id AND feature_key = p_feature_key;

  -- If no record or we're in a new period, calculate new rollover
  IF v_existing_rollover IS NULL THEN
    -- First time - no rollover yet
    INSERT INTO plan_credit_rollovers (user_id, feature_key, rollover_credits, last_period_end)
    VALUES (p_user_id, p_feature_key, 0, p_period_end)
    ON CONFLICT (user_id, feature_key) DO NOTHING;
    RETURN 0;
  END IF;

  -- Check if we've crossed into a new period
  IF p_period_start > v_existing_rollover.last_period_end THEN
    -- Calculate unused from previous period (we need to track this separately)
    -- For now, use the stored rollover + any unused from last period
    -- The unused credits are: plan_limit - current_used (but current_used is for NEW period)
    -- We need to get last period's unused... this is tricky
    
    -- Simplified approach: rollover is already stored, just cap it
    v_total_rollover := LEAST(v_existing_rollover.rollover_credits, p_plan_limit);
    
    -- Update the period end
    UPDATE plan_credit_rollovers
    SET last_period_end = p_period_end, updated_at = now()
    WHERE user_id = p_user_id AND feature_key = p_feature_key;
    
    RETURN v_total_rollover;
  END IF;

  -- Same period - return existing rollover (capped)
  RETURN LEAST(v_existing_rollover.rollover_credits, p_plan_limit);
END;
$$;

-- Function to update rollover after consumption (called at period end or when consuming)
CREATE OR REPLACE FUNCTION public.update_plan_rollover(
  p_user_id UUID,
  p_feature_key TEXT,
  p_unused_credits INTEGER,
  p_plan_limit INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capped_rollover INTEGER;
BEGIN
  -- Cap rollover at the plan limit
  v_capped_rollover := LEAST(p_unused_credits, p_plan_limit);
  
  INSERT INTO plan_credit_rollovers (user_id, feature_key, rollover_credits, last_period_end)
  VALUES (p_user_id, p_feature_key, v_capped_rollover, now())
  ON CONFLICT (user_id, feature_key) 
  DO UPDATE SET 
    rollover_credits = v_capped_rollover,
    updated_at = now();
END;
$$;

-- Update get_unified_credits to include rollover
CREATE OR REPLACE FUNCTION public.get_unified_credits(
  p_user_id UUID,
  p_feature_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_limit INTEGER;
  v_plan_used INTEGER;
  v_plan_remaining INTEGER;
  v_plan_rollover INTEGER;
  v_program_total INTEGER;
  v_program_used INTEGER;
  v_program_remaining INTEGER;
  v_addon_remaining INTEGER;
  v_total_remaining INTEGER;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_feature_id UUID;
  v_rollover_record RECORD;
BEGIN
  -- Get feature ID
  SELECT id INTO v_feature_id FROM features WHERE key = p_feature_key;
  IF v_feature_id IS NULL THEN
    RETURN jsonb_build_object(
      'plan', jsonb_build_object('limit', NULL, 'used', 0, 'remaining', 0, 'rollover', 0),
      'program', jsonb_build_object('total', 0, 'used', 0, 'remaining', 0),
      'addon', jsonb_build_object('remaining', 0),
      'total_remaining', 0
    );
  END IF;

  -- Calculate billing period (assuming monthly from subscription or profile creation)
  v_period_start := date_trunc('month', now());
  v_period_end := (date_trunc('month', now()) + interval '1 month');

  -- Get plan credits
  SELECT pf.usage_limit INTO v_plan_limit
  FROM profiles p
  JOIN plans pl ON p.plan_id = pl.id
  JOIN plan_features pf ON pl.id = pf.plan_id
  WHERE p.id = p_user_id AND pf.feature_id = v_feature_id;

  -- Get plan usage for current period
  SELECT COALESCE(SUM(quantity_consumed), 0) INTO v_plan_used
  FROM consumable_usage_log
  WHERE user_id = p_user_id 
    AND feature_id = v_feature_id
    AND consumed_at >= v_period_start
    AND consumed_at < v_period_end;

  -- Get rollover credits (capped at plan limit)
  SELECT * INTO v_rollover_record
  FROM plan_credit_rollovers
  WHERE user_id = p_user_id AND feature_key = p_feature_key;

  IF v_rollover_record IS NOT NULL AND v_plan_limit IS NOT NULL THEN
    -- Check if we've entered a new period
    IF v_period_start > v_rollover_record.last_period_end THEN
      -- Calculate unused from previous period and add to rollover (capped)
      -- Previous period's unused = what was remaining (limit + old_rollover - used)
      -- But we don't have previous period's usage here, so we rely on the stored rollover
      v_plan_rollover := LEAST(v_rollover_record.rollover_credits, v_plan_limit);
      
      -- Update the period marker
      UPDATE plan_credit_rollovers
      SET last_period_end = v_period_end, updated_at = now()
      WHERE user_id = p_user_id AND feature_key = p_feature_key;
    ELSE
      v_plan_rollover := LEAST(v_rollover_record.rollover_credits, v_plan_limit);
    END IF;
  ELSE
    v_plan_rollover := 0;
    -- Initialize rollover record
    IF v_plan_limit IS NOT NULL THEN
      INSERT INTO plan_credit_rollovers (user_id, feature_key, rollover_credits, last_period_end)
      VALUES (p_user_id, p_feature_key, 0, v_period_end)
      ON CONFLICT (user_id, feature_key) DO NOTHING;
    END IF;
  END IF;

  -- Calculate plan remaining (current period + rollover)
  IF v_plan_limit IS NULL THEN
    v_plan_remaining := 0;
  ELSE
    v_plan_remaining := GREATEST(0, (v_plan_limit + v_plan_rollover) - v_plan_used);
  END IF;

  -- Get program entitlements
  SELECT 
    COALESCE(SUM(pe.quantity), 0),
    COALESCE(SUM(upeu.quantity_used), 0)
  INTO v_program_total, v_program_used
  FROM program_entitlements pe
  JOIN client_enrollments ce ON pe.program_id = ce.program_id
  LEFT JOIN user_program_entitlement_usage upeu 
    ON upeu.program_entitlement_id = pe.id AND upeu.user_id = p_user_id
  WHERE ce.client_user_id = p_user_id
    AND ce.status = 'active'
    AND pe.feature_key = p_feature_key
    AND (ce.end_date IS NULL OR ce.end_date > now());

  v_program_remaining := GREATEST(0, v_program_total - v_program_used);

  -- Get add-on credits
  SELECT COALESCE(SUM(ua.remaining_quantity), 0) INTO v_addon_remaining
  FROM user_add_ons ua
  JOIN add_ons a ON ua.add_on_id = a.id
  JOIN add_on_features af ON a.id = af.add_on_id
  WHERE ua.user_id = p_user_id 
    AND af.feature_id = v_feature_id
    AND ua.remaining_quantity > 0
    AND (ua.expires_at IS NULL OR ua.expires_at > now());

  v_total_remaining := v_plan_remaining + v_program_remaining + v_addon_remaining;

  RETURN jsonb_build_object(
    'plan', jsonb_build_object(
      'limit', v_plan_limit, 
      'used', v_plan_used, 
      'remaining', v_plan_remaining,
      'rollover', v_plan_rollover,
      'current_period_remaining', GREATEST(0, COALESCE(v_plan_limit, 0) - v_plan_used)
    ),
    'program', jsonb_build_object('total', v_program_total, 'used', v_program_used, 'remaining', v_program_remaining),
    'addon', jsonb_build_object('remaining', v_addon_remaining),
    'total_remaining', v_total_remaining
  );
END;
$$;

-- Update consume_unified_credits to handle rollover
CREATE OR REPLACE FUNCTION public.consume_unified_credits(
  p_user_id UUID,
  p_feature_key TEXT,
  p_quantity INTEGER DEFAULT 1,
  p_action_type TEXT DEFAULT 'general',
  p_action_reference_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits JSONB;
  v_remaining INTEGER;
  v_to_consume INTEGER;
  v_consumed INTEGER := 0;
  v_consumed_from TEXT;
  v_feature_id UUID;
  v_plan_remaining INTEGER;
  v_plan_rollover INTEGER;
  v_plan_current INTEGER;
  v_program_remaining INTEGER;
  v_addon_remaining INTEGER;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_plan_limit INTEGER;
  v_new_rollover INTEGER;
BEGIN
  -- Get current credits
  v_credits := get_unified_credits(p_user_id, p_feature_key);
  v_remaining := (v_credits->>'total_remaining')::INTEGER;

  IF v_remaining < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'requested', p_quantity,
      'available', v_remaining
    );
  END IF;

  -- Get feature ID
  SELECT id INTO v_feature_id FROM features WHERE key = p_feature_key;
  
  v_to_consume := p_quantity;
  v_plan_remaining := (v_credits->'plan'->>'remaining')::INTEGER;
  v_plan_rollover := (v_credits->'plan'->>'rollover')::INTEGER;
  v_plan_current := (v_credits->'plan'->>'current_period_remaining')::INTEGER;
  v_program_remaining := (v_credits->'program'->>'remaining')::INTEGER;
  v_addon_remaining := (v_credits->'addon'->>'remaining')::INTEGER;
  
  v_period_start := date_trunc('month', now());
  v_period_end := (date_trunc('month', now()) + interval '1 month');

  -- Get plan limit for rollover cap
  SELECT pf.usage_limit INTO v_plan_limit
  FROM profiles p
  JOIN plans pl ON p.plan_id = pl.id
  JOIN plan_features pf ON pl.id = pf.plan_id
  WHERE p.id = p_user_id AND pf.feature_id = v_feature_id;

  -- Priority 1: Consume from plan rollover first (use older credits first - FIFO)
  IF v_to_consume > 0 AND v_plan_rollover > 0 THEN
    v_consumed := LEAST(v_to_consume, v_plan_rollover);
    v_to_consume := v_to_consume - v_consumed;
    v_consumed_from := 'plan_rollover';
    
    -- Reduce rollover credits
    UPDATE plan_credit_rollovers
    SET rollover_credits = rollover_credits - v_consumed, updated_at = now()
    WHERE user_id = p_user_id AND feature_key = p_feature_key;
    
    -- Log consumption
    INSERT INTO consumable_usage_log (user_id, feature_id, quantity_consumed, action_type, action_reference_id, notes)
    VALUES (p_user_id, v_feature_id, v_consumed, p_action_type || '_rollover', p_action_reference_id, p_notes);
  END IF;

  -- Priority 2: Consume from current plan period
  IF v_to_consume > 0 AND v_plan_current > 0 THEN
    v_consumed := v_consumed + LEAST(v_to_consume, v_plan_current);
    v_to_consume := v_to_consume - LEAST(v_to_consume, v_plan_current);
    IF v_consumed_from IS NULL THEN
      v_consumed_from := 'plan';
    END IF;
    
    -- Log consumption
    INSERT INTO consumable_usage_log (user_id, feature_id, quantity_consumed, action_type, action_reference_id, notes)
    VALUES (p_user_id, v_feature_id, LEAST(v_to_consume + LEAST(v_to_consume, v_plan_current), v_plan_current), p_action_type, p_action_reference_id, p_notes);
  END IF;

  -- Priority 3: Consume from program entitlements
  IF v_to_consume > 0 AND v_program_remaining > 0 THEN
    DECLARE
      v_entitlement RECORD;
      v_consume_from_entitlement INTEGER;
    BEGIN
      FOR v_entitlement IN 
        SELECT pe.id, pe.quantity - COALESCE(upeu.quantity_used, 0) as available
        FROM program_entitlements pe
        JOIN client_enrollments ce ON pe.program_id = ce.program_id
        LEFT JOIN user_program_entitlement_usage upeu 
          ON upeu.program_entitlement_id = pe.id AND upeu.user_id = p_user_id
        WHERE ce.client_user_id = p_user_id
          AND ce.status = 'active'
          AND pe.feature_key = p_feature_key
          AND (ce.end_date IS NULL OR ce.end_date > now())
          AND pe.quantity - COALESCE(upeu.quantity_used, 0) > 0
        ORDER BY ce.start_date ASC
      LOOP
        EXIT WHEN v_to_consume <= 0;
        
        v_consume_from_entitlement := LEAST(v_to_consume, v_entitlement.available);
        
        INSERT INTO user_program_entitlement_usage (user_id, program_entitlement_id, quantity_used, action_type, action_reference_id, notes)
        VALUES (p_user_id, v_entitlement.id, v_consume_from_entitlement, p_action_type, p_action_reference_id, p_notes)
        ON CONFLICT (user_id, program_entitlement_id) 
        DO UPDATE SET quantity_used = user_program_entitlement_usage.quantity_used + v_consume_from_entitlement, updated_at = now();
        
        v_consumed := v_consumed + v_consume_from_entitlement;
        v_to_consume := v_to_consume - v_consume_from_entitlement;
        
        IF v_consumed_from IS NULL THEN
          v_consumed_from := 'program';
        END IF;
      END LOOP;
    END;
  END IF;

  -- Priority 4: Consume from add-ons
  IF v_to_consume > 0 AND v_addon_remaining > 0 THEN
    DECLARE
      v_addon RECORD;
      v_consume_from_addon INTEGER;
    BEGIN
      FOR v_addon IN 
        SELECT ua.id, ua.remaining_quantity
        FROM user_add_ons ua
        JOIN add_ons a ON ua.add_on_id = a.id
        JOIN add_on_features af ON a.id = af.add_on_id
        WHERE ua.user_id = p_user_id 
          AND af.feature_id = v_feature_id
          AND ua.remaining_quantity > 0
          AND (ua.expires_at IS NULL OR ua.expires_at > now())
        ORDER BY ua.expires_at ASC NULLS LAST, ua.created_at ASC
      LOOP
        EXIT WHEN v_to_consume <= 0;
        
        v_consume_from_addon := LEAST(v_to_consume, v_addon.remaining_quantity);
        
        UPDATE user_add_ons 
        SET remaining_quantity = remaining_quantity - v_consume_from_addon, updated_at = now()
        WHERE id = v_addon.id;
        
        INSERT INTO add_on_consumption_log (user_id, user_add_on_id, quantity_consumed, action_type, action_reference_id, notes)
        VALUES (p_user_id, v_addon.id, v_consume_from_addon, p_action_type, p_action_reference_id, p_notes);
        
        v_consumed := v_consumed + v_consume_from_addon;
        v_to_consume := v_to_consume - v_consume_from_addon;
        
        IF v_consumed_from IS NULL THEN
          v_consumed_from := 'addon';
        END IF;
      END LOOP;
    END;
  END IF;

  -- Get updated credits
  v_credits := get_unified_credits(p_user_id, p_feature_key);

  RETURN jsonb_build_object(
    'success', true,
    'consumed', p_quantity,
    'consumed_from', v_consumed_from,
    'remaining', jsonb_build_object(
      'plan', (v_credits->'plan'->>'remaining')::INTEGER,
      'program', (v_credits->'program'->>'remaining')::INTEGER,
      'addon', (v_credits->'addon'->>'remaining')::INTEGER,
      'total', (v_credits->>'total_remaining')::INTEGER
    )
  );
END;
$$;

-- Function to calculate and store rollover at end of period (to be called by a scheduled job or trigger)
CREATE OR REPLACE FUNCTION public.process_monthly_rollover()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_feature RECORD;
  v_period_start TIMESTAMPTZ;
  v_unused INTEGER;
  v_current_rollover INTEGER;
  v_new_rollover INTEGER;
  v_plan_limit INTEGER;
BEGIN
  v_period_start := date_trunc('month', now());
  
  -- For each user with a plan
  FOR v_user IN 
    SELECT p.id as user_id, p.plan_id 
    FROM profiles p 
    WHERE p.plan_id IS NOT NULL
  LOOP
    -- For each consumable feature in their plan
    FOR v_feature IN 
      SELECT f.key as feature_key, f.id as feature_id, pf.usage_limit
      FROM plan_features pf
      JOIN features f ON pf.feature_id = f.id
      WHERE pf.plan_id = v_user.plan_id 
        AND f.is_consumable = true
        AND pf.usage_limit IS NOT NULL
    LOOP
      -- Get current rollover
      SELECT COALESCE(rollover_credits, 0) INTO v_current_rollover
      FROM plan_credit_rollovers
      WHERE user_id = v_user.user_id AND feature_key = v_feature.feature_key;
      
      -- Calculate unused from previous month
      SELECT v_feature.usage_limit + COALESCE(v_current_rollover, 0) - COALESCE(SUM(quantity_consumed), 0)
      INTO v_unused
      FROM consumable_usage_log
      WHERE user_id = v_user.user_id 
        AND feature_id = v_feature.feature_id
        AND consumed_at >= v_period_start - interval '1 month'
        AND consumed_at < v_period_start;
      
      -- Cap the new rollover at the plan limit
      v_new_rollover := LEAST(GREATEST(0, COALESCE(v_unused, v_feature.usage_limit)), v_feature.usage_limit);
      
      -- Update or insert rollover
      INSERT INTO plan_credit_rollovers (user_id, feature_key, rollover_credits, last_period_end)
      VALUES (v_user.user_id, v_feature.feature_key, v_new_rollover, v_period_start)
      ON CONFLICT (user_id, feature_key) 
      DO UPDATE SET 
        rollover_credits = v_new_rollover,
        last_period_end = v_period_start,
        updated_at = now();
    END LOOP;
  END LOOP;
END;
$$;