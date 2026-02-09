-- Add expiry tracking to plan_credit_rollovers
ALTER TABLE public.plan_credit_rollovers 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS source_period_start TIMESTAMPTZ;

-- Update existing records to set expiry (1 month from last_period_end)
UPDATE public.plan_credit_rollovers 
SET expires_at = last_period_end + INTERVAL '1 month',
    source_period_start = last_period_end - INTERVAL '1 month'
WHERE expires_at IS NULL;

-- Create function to process monthly credit rollovers
CREATE OR REPLACE FUNCTION public.process_monthly_credit_rollovers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user RECORD;
  v_feature RECORD;
  v_plan_limit INTEGER;
  v_used INTEGER;
  v_unused INTEGER;
  v_current_rollover INTEGER;
  v_new_rollover INTEGER;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_previous_period_start TIMESTAMPTZ;
  v_previous_period_end TIMESTAMPTZ;
  v_processed_count INTEGER := 0;
  v_expired_count INTEGER := 0;
BEGIN
  -- Current and previous period boundaries
  v_period_start := date_trunc('month', now());
  v_period_end := v_period_start + INTERVAL '1 month';
  v_previous_period_start := v_period_start - INTERVAL '1 month';
  v_previous_period_end := v_period_start;

  -- First, expire any rollover credits older than 1 month
  UPDATE plan_credit_rollovers
  SET rollover_credits = 0, updated_at = now()
  WHERE expires_at < now() AND rollover_credits > 0;
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Process each user with a plan that has consumable features
  FOR v_user IN 
    SELECT DISTINCT p.id as user_id, p.plan_id
    FROM profiles p
    WHERE p.plan_id IS NOT NULL
  LOOP
    -- Process each consumable feature for this user's plan
    FOR v_feature IN
      SELECT f.id as feature_id, f.key as feature_key, pf.limit_value as plan_limit
      FROM plan_features pf
      JOIN features f ON f.id = pf.feature_id
      WHERE pf.plan_id = v_user.plan_id
        AND pf.enabled = true
        AND f.is_consumable = true
        AND pf.limit_value IS NOT NULL
    LOOP
      v_plan_limit := v_feature.plan_limit;

      -- Get usage from the PREVIOUS period
      SELECT COALESCE(SUM(quantity_consumed), 0) INTO v_used
      FROM consumable_usage_log
      WHERE user_id = v_user.user_id
        AND feature_id = v_feature.feature_id
        AND consumed_at >= v_previous_period_start
        AND consumed_at < v_previous_period_end;

      -- Get current rollover credits
      SELECT COALESCE(rollover_credits, 0) INTO v_current_rollover
      FROM plan_credit_rollovers
      WHERE user_id = v_user.user_id AND feature_key = v_feature.feature_key;

      -- Calculate unused credits from previous period (plan limit + old rollover - used)
      v_unused := GREATEST(0, (v_plan_limit + COALESCE(v_current_rollover, 0)) - v_used);
      
      -- New rollover is capped at plan limit and only carries for 1 month
      v_new_rollover := LEAST(v_unused, v_plan_limit);

      -- Upsert rollover record
      INSERT INTO plan_credit_rollovers (user_id, feature_key, rollover_credits, last_period_end, source_period_start, expires_at)
      VALUES (v_user.user_id, v_feature.feature_key, v_new_rollover, v_period_end, v_previous_period_start, v_period_end + INTERVAL '1 month')
      ON CONFLICT (user_id, feature_key) DO UPDATE SET
        rollover_credits = v_new_rollover,
        last_period_end = v_period_end,
        source_period_start = v_previous_period_start,
        expires_at = v_period_end + INTERVAL '1 month',
        updated_at = now();

      v_processed_count := v_processed_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_processed_count,
    'expired_count', v_expired_count,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
END;
$$;

-- Update get_unified_credits to check expiry and handle tier inheritance
CREATE OR REPLACE FUNCTION public.get_unified_credits(p_user_id uuid, p_feature_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_user_tier INTEGER;
  v_feature_tier INTEGER;
  v_feature_tier_key TEXT;
BEGIN
  -- Get feature ID
  SELECT id INTO v_feature_id FROM features WHERE key = p_feature_key;
  IF v_feature_id IS NULL THEN
    RETURN jsonb_build_object(
      'plan', jsonb_build_object('limit', NULL, 'used', 0, 'remaining', 0, 'rollover', 0, 'current_period_remaining', 0),
      'program', jsonb_build_object('total', 0, 'used', 0, 'remaining', 0),
      'addon', jsonb_build_object('remaining', 0),
      'total_remaining', 0
    );
  END IF;

  -- Calculate billing period (monthly)
  v_period_start := date_trunc('month', now());
  v_period_end := (date_trunc('month', now()) + interval '1 month');

  -- Get user's tier level
  SELECT pl.tier_level INTO v_user_tier
  FROM profiles p
  JOIN plans pl ON p.plan_id = pl.id
  WHERE p.id = p_user_id;

  -- Get plan credits - check for tier inheritance (e.g., Pro can access Base features)
  -- First try direct feature access
  SELECT pf.limit_value INTO v_plan_limit
  FROM profiles p
  JOIN plans pl ON p.plan_id = pl.id
  JOIN plan_features pf ON pl.id = pf.plan_id
  WHERE p.id = p_user_id 
    AND pf.feature_id = v_feature_id
    AND pf.enabled = true;

  -- If no direct access, check if this is a tiered program feature (e.g., programs_base, programs_pro)
  -- and if user's tier allows access to lower tier features
  IF v_plan_limit IS NULL AND v_user_tier IS NOT NULL THEN
    -- Check for tiered feature patterns like programs_base, programs_pro, programs_advanced
    IF p_feature_key LIKE 'programs_%' THEN
      -- Extract tier from feature key and check if user tier is >= feature tier
      CASE 
        WHEN p_feature_key = 'programs_base' THEN v_feature_tier := 2;
        WHEN p_feature_key = 'programs_pro' THEN v_feature_tier := 3;
        WHEN p_feature_key = 'programs_advanced' THEN v_feature_tier := 4;
        ELSE v_feature_tier := NULL;
      END CASE;

      -- If user tier >= feature tier, get the limit from their actual plan for that tier
      IF v_feature_tier IS NOT NULL AND v_user_tier >= v_feature_tier THEN
        -- Get the limit from the plan at the feature's tier level (for inherited access)
        SELECT pf.limit_value INTO v_plan_limit
        FROM plans pl
        JOIN plan_features pf ON pl.id = pf.plan_id
        WHERE pl.tier_level = v_feature_tier
          AND pf.feature_id = v_feature_id
          AND pf.enabled = true;
      END IF;
    END IF;
  END IF;

  -- Get plan usage for current period
  SELECT COALESCE(SUM(quantity_consumed), 0) INTO v_plan_used
  FROM consumable_usage_log
  WHERE user_id = p_user_id 
    AND feature_id = v_feature_id
    AND consumed_at >= v_period_start
    AND consumed_at < v_period_end;

  -- Get rollover credits (only if not expired)
  SELECT * INTO v_rollover_record
  FROM plan_credit_rollovers
  WHERE user_id = p_user_id 
    AND feature_key = p_feature_key
    AND (expires_at IS NULL OR expires_at > now());

  IF v_rollover_record IS NOT NULL AND v_plan_limit IS NOT NULL THEN
    v_plan_rollover := LEAST(v_rollover_record.rollover_credits, v_plan_limit);
  ELSE
    v_plan_rollover := 0;
    -- Initialize rollover record if needed
    IF v_plan_limit IS NOT NULL THEN
      INSERT INTO plan_credit_rollovers (user_id, feature_key, rollover_credits, last_period_end, expires_at)
      VALUES (p_user_id, p_feature_key, 0, v_period_end, v_period_end + INTERVAL '1 month')
      ON CONFLICT (user_id, feature_key) DO NOTHING;
    END IF;
  END IF;

  -- Calculate plan remaining (current period + rollover)
  IF v_plan_limit IS NULL THEN
    v_plan_remaining := 0;
  ELSE
    v_plan_remaining := GREATEST(0, (v_plan_limit + v_plan_rollover) - v_plan_used);
  END IF;

  -- Get program entitlements (also with tier inheritance)
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

-- Schedule monthly credit rollover job (runs at midnight on 1st of each month)
SELECT cron.schedule(
  'monthly-credit-rollover',
  '0 0 1 * *',
  $$SELECT public.process_monthly_credit_rollovers()$$
);