-- Create program_entitlements table for program-granted credits
CREATE TABLE public.program_entitlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, feature_key)
);

-- Track user consumption of program entitlements
CREATE TABLE public.user_program_entitlement_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  enrollment_id UUID NOT NULL REFERENCES public.client_enrollments(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, feature_key)
);

-- Enable RLS
ALTER TABLE public.program_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_program_entitlement_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for program_entitlements (admin manage, all read)
CREATE POLICY "Admins can manage program entitlements" ON public.program_entitlements
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view program entitlements" ON public.program_entitlements
  FOR SELECT USING (true);

-- RLS policies for user_program_entitlement_usage
CREATE POLICY "Users can view own entitlement usage" ON public.user_program_entitlement_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own entitlement usage" ON public.user_program_entitlement_usage
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all entitlement usage" ON public.user_program_entitlement_usage
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Unified consumption function
CREATE OR REPLACE FUNCTION public.consume_unified_credits(
  p_user_id UUID,
  p_feature_key TEXT,
  p_quantity INTEGER DEFAULT 1,
  p_action_type TEXT DEFAULT 'general',
  p_action_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_limit INTEGER;
  v_plan_used INTEGER;
  v_plan_remaining INTEGER;
  v_program_total INTEGER := 0;
  v_program_used INTEGER := 0;
  v_program_remaining INTEGER := 0;
  v_addon_remaining INTEGER := 0;
  v_total_available INTEGER;
  v_consumed_from TEXT;
  v_user_plan_id UUID;
  v_feature_id UUID;
  v_enrollment RECORD;
  v_entitlement RECORD;
  v_user_addon RECORD;
  v_period_start TIMESTAMPTZ;
BEGIN
  -- Verify caller
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_period_start := date_trunc('month', now());

  -- Get user's plan
  SELECT plan_id INTO v_user_plan_id FROM profiles WHERE id = p_user_id;

  -- Get feature details
  SELECT id INTO v_feature_id FROM features WHERE key = p_feature_key;

  -- 1. Check PLAN credits (renewable monthly)
  IF v_user_plan_id IS NOT NULL AND v_feature_id IS NOT NULL THEN
    SELECT pf.limit_value INTO v_plan_limit
    FROM plan_features pf
    WHERE pf.plan_id = v_user_plan_id AND pf.feature_id = v_feature_id AND pf.is_enabled = true;

    SELECT COALESCE(used_count, 0) INTO v_plan_used
    FROM usage_tracking
    WHERE user_id = p_user_id AND feature_key = p_feature_key AND period_start = v_period_start;

    v_plan_used := COALESCE(v_plan_used, 0);
    
    IF v_plan_limit IS NOT NULL THEN
      v_plan_remaining := GREATEST(0, v_plan_limit - v_plan_used);
    ELSE
      v_plan_remaining := 0;
    END IF;
  END IF;

  -- 2. Check PROGRAM entitlements (duration-based)
  FOR v_enrollment IN
    SELECT ce.id as enrollment_id, pe.quantity as entitled
    FROM client_enrollments ce
    JOIN program_entitlements pe ON pe.program_id = ce.program_id
    WHERE ce.client_user_id = p_user_id 
      AND ce.status = 'active'
      AND pe.feature_key = p_feature_key
  LOOP
    v_program_total := v_program_total + v_enrollment.entitled;
    
    SELECT COALESCE(used_count, 0) INTO v_program_used
    FROM user_program_entitlement_usage
    WHERE enrollment_id = v_enrollment.enrollment_id AND feature_key = p_feature_key;
    
    v_program_used := COALESCE(v_program_used, 0);
  END LOOP;
  
  v_program_remaining := GREATEST(0, v_program_total - v_program_used);

  -- 3. Check ADD-ON credits (one-time purchase)
  SELECT COALESCE(SUM(ua.quantity_remaining), 0) INTO v_addon_remaining
  FROM user_add_ons ua
  JOIN add_ons a ON a.id = ua.add_on_id
  JOIN add_on_features af ON af.add_on_id = a.id
  JOIN features f ON f.id = af.feature_id
  WHERE ua.user_id = p_user_id
    AND f.key = p_feature_key
    AND a.is_consumable = true
    AND (ua.expires_at IS NULL OR ua.expires_at > now())
    AND ua.quantity_remaining > 0;

  -- Calculate total
  v_total_available := v_plan_remaining + v_program_remaining + v_addon_remaining;

  -- Check if we have enough
  IF v_total_available < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'plan_remaining', v_plan_remaining,
      'program_remaining', v_program_remaining,
      'addon_remaining', v_addon_remaining,
      'total_available', v_total_available,
      'requested', p_quantity
    );
  END IF;

  -- CONSUME in priority order: Plan -> Program -> Add-on
  DECLARE
    v_to_consume INTEGER := p_quantity;
    v_consumed_plan INTEGER := 0;
    v_consumed_program INTEGER := 0;
    v_consumed_addon INTEGER := 0;
  BEGIN
    -- 1. Consume from Plan first (renewable)
    IF v_to_consume > 0 AND v_plan_remaining > 0 THEN
      v_consumed_plan := LEAST(v_to_consume, v_plan_remaining);
      v_to_consume := v_to_consume - v_consumed_plan;
      
      INSERT INTO usage_tracking (user_id, feature_key, used_count, period_start, period_end)
      VALUES (p_user_id, p_feature_key, v_consumed_plan, v_period_start, v_period_start + interval '1 month')
      ON CONFLICT (user_id, feature_key, period_start)
      DO UPDATE SET used_count = usage_tracking.used_count + v_consumed_plan, updated_at = now();
    END IF;

    -- 2. Consume from Program entitlements
    IF v_to_consume > 0 AND v_program_remaining > 0 THEN
      FOR v_enrollment IN
        SELECT ce.id as enrollment_id, pe.quantity as entitled,
               COALESCE(upeu.used_count, 0) as used
        FROM client_enrollments ce
        JOIN program_entitlements pe ON pe.program_id = ce.program_id
        LEFT JOIN user_program_entitlement_usage upeu 
          ON upeu.enrollment_id = ce.id AND upeu.feature_key = p_feature_key
        WHERE ce.client_user_id = p_user_id 
          AND ce.status = 'active'
          AND pe.feature_key = p_feature_key
          AND pe.quantity > COALESCE(upeu.used_count, 0)
        ORDER BY ce.created_at
      LOOP
        IF v_to_consume <= 0 THEN EXIT; END IF;
        
        DECLARE
          v_available INTEGER := v_enrollment.entitled - v_enrollment.used;
          v_take INTEGER := LEAST(v_to_consume, v_available);
        BEGIN
          v_consumed_program := v_consumed_program + v_take;
          v_to_consume := v_to_consume - v_take;
          
          INSERT INTO user_program_entitlement_usage (user_id, enrollment_id, feature_key, used_count)
          VALUES (p_user_id, v_enrollment.enrollment_id, p_feature_key, v_take)
          ON CONFLICT (enrollment_id, feature_key)
          DO UPDATE SET used_count = user_program_entitlement_usage.used_count + v_take, updated_at = now();
        END;
      END LOOP;
    END IF;

    -- 3. Consume from Add-ons (paid extra, use last)
    IF v_to_consume > 0 AND v_addon_remaining > 0 THEN
      FOR v_user_addon IN
        SELECT ua.id, ua.quantity_remaining
        FROM user_add_ons ua
        JOIN add_ons a ON a.id = ua.add_on_id
        JOIN add_on_features af ON af.add_on_id = a.id
        JOIN features f ON f.id = af.feature_id
        WHERE ua.user_id = p_user_id
          AND f.key = p_feature_key
          AND a.is_consumable = true
          AND (ua.expires_at IS NULL OR ua.expires_at > now())
          AND ua.quantity_remaining > 0
        ORDER BY ua.expires_at NULLS LAST, ua.created_at
      LOOP
        IF v_to_consume <= 0 THEN EXIT; END IF;
        
        DECLARE
          v_take INTEGER := LEAST(v_to_consume, v_user_addon.quantity_remaining);
        BEGIN
          v_consumed_addon := v_consumed_addon + v_take;
          v_to_consume := v_to_consume - v_take;
          
          UPDATE user_add_ons
          SET quantity_remaining = quantity_remaining - v_take,
              quantity_used = quantity_used + v_take
          WHERE id = v_user_addon.id;
          
          INSERT INTO add_on_consumption_log (user_add_on_id, user_id, quantity_consumed, action_type, action_reference_id, notes)
          VALUES (v_user_addon.id, p_user_id, v_take, p_action_type, p_action_reference_id, p_notes);
        END;
      END LOOP;
    END IF;

    -- Build consumed_from description
    v_consumed_from := '';
    IF v_consumed_plan > 0 THEN v_consumed_from := v_consumed_from || 'plan:' || v_consumed_plan; END IF;
    IF v_consumed_program > 0 THEN 
      IF v_consumed_from != '' THEN v_consumed_from := v_consumed_from || ','; END IF;
      v_consumed_from := v_consumed_from || 'program:' || v_consumed_program; 
    END IF;
    IF v_consumed_addon > 0 THEN 
      IF v_consumed_from != '' THEN v_consumed_from := v_consumed_from || ','; END IF;
      v_consumed_from := v_consumed_from || 'addon:' || v_consumed_addon; 
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'consumed', p_quantity,
      'consumed_from', v_consumed_from,
      'remaining', jsonb_build_object(
        'plan', v_plan_remaining - v_consumed_plan,
        'program', v_program_remaining - v_consumed_program,
        'addon', v_addon_remaining - v_consumed_addon,
        'total', v_total_available - p_quantity
      )
    );
  END;
END;
$$;

-- Function to get unified credit balance
CREATE OR REPLACE FUNCTION public.get_unified_credits(p_user_id UUID, p_feature_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_limit INTEGER;
  v_plan_used INTEGER := 0;
  v_plan_remaining INTEGER := 0;
  v_program_total INTEGER := 0;
  v_program_used INTEGER := 0;
  v_program_remaining INTEGER := 0;
  v_addon_remaining INTEGER := 0;
  v_user_plan_id UUID;
  v_feature_id UUID;
  v_period_start TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  v_period_start := date_trunc('month', now());

  SELECT plan_id INTO v_user_plan_id FROM profiles WHERE id = p_user_id;
  SELECT id INTO v_feature_id FROM features WHERE key = p_feature_key;

  -- Plan credits
  IF v_user_plan_id IS NOT NULL AND v_feature_id IS NOT NULL THEN
    SELECT pf.limit_value INTO v_plan_limit
    FROM plan_features pf
    WHERE pf.plan_id = v_user_plan_id AND pf.feature_id = v_feature_id AND pf.is_enabled = true;

    SELECT COALESCE(used_count, 0) INTO v_plan_used
    FROM usage_tracking
    WHERE user_id = p_user_id AND feature_key = p_feature_key AND period_start = v_period_start;

    IF v_plan_limit IS NOT NULL THEN
      v_plan_remaining := GREATEST(0, v_plan_limit - COALESCE(v_plan_used, 0));
    END IF;
  END IF;

  -- Program entitlements
  SELECT COALESCE(SUM(pe.quantity), 0), COALESCE(SUM(upeu.used_count), 0)
  INTO v_program_total, v_program_used
  FROM client_enrollments ce
  JOIN program_entitlements pe ON pe.program_id = ce.program_id AND pe.feature_key = p_feature_key
  LEFT JOIN user_program_entitlement_usage upeu ON upeu.enrollment_id = ce.id AND upeu.feature_key = p_feature_key
  WHERE ce.client_user_id = p_user_id AND ce.status = 'active';

  v_program_remaining := GREATEST(0, v_program_total - v_program_used);

  -- Add-on credits
  SELECT COALESCE(SUM(ua.quantity_remaining), 0) INTO v_addon_remaining
  FROM user_add_ons ua
  JOIN add_ons a ON a.id = ua.add_on_id
  JOIN add_on_features af ON af.add_on_id = a.id
  JOIN features f ON f.id = af.feature_id
  WHERE ua.user_id = p_user_id
    AND f.key = p_feature_key
    AND a.is_consumable = true
    AND (ua.expires_at IS NULL OR ua.expires_at > now())
    AND ua.quantity_remaining > 0;

  RETURN jsonb_build_object(
    'plan', jsonb_build_object('limit', v_plan_limit, 'used', v_plan_used, 'remaining', v_plan_remaining),
    'program', jsonb_build_object('total', v_program_total, 'used', v_program_used, 'remaining', v_program_remaining),
    'addon', jsonb_build_object('remaining', v_addon_remaining),
    'total_remaining', v_plan_remaining + v_program_remaining + v_addon_remaining
  );
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_program_entitlements_updated_at
  BEFORE UPDATE ON public.program_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_program_entitlement_usage_updated_at
  BEFORE UPDATE ON public.user_program_entitlement_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();