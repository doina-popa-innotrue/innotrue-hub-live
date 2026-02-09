-- Fix consume_add_on to verify caller matches user_id
CREATE OR REPLACE FUNCTION public.consume_add_on(p_user_id uuid, p_add_on_key text, p_quantity integer DEFAULT 1, p_action_type text DEFAULT 'general'::text, p_action_reference_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_add_on RECORD;
  v_add_on RECORD;
BEGIN
  -- Verify caller matches user_id (security fix)
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get the add-on
  SELECT * INTO v_add_on FROM add_ons WHERE key = p_add_on_key AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add-on not found');
  END IF;

  -- Check if add-on is consumable
  IF NOT v_add_on.is_consumable THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add-on is not consumable');
  END IF;

  -- Get user's add-on with remaining quantity
  SELECT ua.* INTO v_user_add_on 
  FROM user_add_ons ua
  WHERE ua.user_id = p_user_id 
    AND ua.add_on_id = v_add_on.id
    AND (ua.expires_at IS NULL OR ua.expires_at > now())
    AND ua.quantity_remaining >= p_quantity
  ORDER BY ua.expires_at NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'remaining', 0);
  END IF;

  -- Deduct credits
  UPDATE user_add_ons
  SET quantity_remaining = quantity_remaining - p_quantity,
      quantity_used = quantity_used + p_quantity
  WHERE id = v_user_add_on.id;

  -- Log consumption
  INSERT INTO add_on_consumption_log (
    user_add_on_id, user_id, quantity_consumed, action_type, action_reference_id, notes
  ) VALUES (
    v_user_add_on.id, p_user_id, p_quantity, p_action_type, p_action_reference_id, p_notes
  );

  RETURN jsonb_build_object(
    'success', true, 
    'consumed', p_quantity, 
    'remaining', v_user_add_on.quantity_remaining - p_quantity
  );
END;
$function$;

-- Fix get_add_on_balance to verify caller matches user_id
CREATE OR REPLACE FUNCTION public.get_add_on_balance(p_user_id uuid, p_add_on_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total INTEGER;
BEGIN
  -- Verify caller matches user_id (security fix)
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(ua.quantity_remaining), 0) INTO v_total
  FROM user_add_ons ua
  JOIN add_ons a ON a.id = ua.add_on_id
  WHERE ua.user_id = p_user_id
    AND a.key = p_add_on_key
    AND a.is_consumable = true
    AND (ua.expires_at IS NULL OR ua.expires_at > now());
  
  RETURN v_total;
END;
$function$;

-- Fix increment_usage to verify caller matches user_id
CREATE OR REPLACE FUNCTION public.increment_usage(_user_id uuid, _feature_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_usage INTEGER;
  current_period_start TIMESTAMP WITH TIME ZONE;
  current_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verify caller matches user_id (security fix)
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  current_period_start := date_trunc('month', now());
  current_period_end := current_period_start + interval '1 month';
  
  -- Insert or update usage
  INSERT INTO public.usage_tracking (user_id, feature_key, used_count, period_start, period_end)
  VALUES (_user_id, _feature_key, 1, current_period_start, current_period_end)
  ON CONFLICT (user_id, feature_key, period_start)
  DO UPDATE SET 
    used_count = usage_tracking.used_count + 1,
    updated_at = now()
  RETURNING used_count INTO current_usage;
  
  RETURN current_usage;
END;
$function$;

-- Fix get_current_usage to verify caller matches user_id
CREATE OR REPLACE FUNCTION public.get_current_usage(_user_id uuid, _feature_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_usage INTEGER;
  current_period_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verify caller matches user_id (security fix)
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RETURN 0;
  END IF;

  current_period_start := date_trunc('month', now());
  
  SELECT used_count INTO current_usage
  FROM public.usage_tracking
  WHERE user_id = _user_id 
    AND feature_key = _feature_key 
    AND period_start = current_period_start;
  
  RETURN COALESCE(current_usage, 0);
END;
$function$;