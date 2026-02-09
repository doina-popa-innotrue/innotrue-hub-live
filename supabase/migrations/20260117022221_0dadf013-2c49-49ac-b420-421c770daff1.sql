-- Update consume_credit_service to use the new credit batches FIFO system
CREATE OR REPLACE FUNCTION consume_credit_service(
  p_user_id UUID,
  p_service_id UUID,
  p_action_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service RECORD;
  v_cost INTEGER;
  v_feature_key TEXT;
  v_consume_result JSONB;
BEGIN
  -- Get the service details
  SELECT cs.*, f.key as feature_key
  INTO v_service
  FROM credit_services cs
  LEFT JOIN features f ON cs.feature_id = f.id
  WHERE cs.id = p_service_id AND cs.is_active = true;
  
  IF v_service IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Service not found or inactive'
    );
  END IF;
  
  -- Calculate cost (check for track discount)
  v_cost := v_service.credit_cost;
  v_feature_key := v_service.feature_key;
  
  IF v_service.track_id IS NOT NULL AND v_service.track_discounted_cost IS NOT NULL THEN
    -- Check if user has this track
    IF EXISTS (
      SELECT 1 FROM user_tracks
      WHERE user_id = p_user_id
      AND track_id = v_service.track_id
      AND status = 'active'
    ) THEN
      v_cost := v_service.track_discounted_cost;
    END IF;
  END IF;
  
  -- Consume credits using FIFO
  v_consume_result := consume_credits_fifo(
    'user',
    p_user_id,
    v_cost,
    v_feature_key,
    'service_consumption',
    p_action_reference_id::TEXT,
    COALESCE(p_notes, 'Consumed ' || v_service.name)
  );
  
  IF (v_consume_result->>'success')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', true,
      'credits_consumed', v_cost,
      'balance_after', (v_consume_result->>'balance_after')::INTEGER,
      'service_name', v_service.name
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_consume_result->>'error', 'Insufficient credits'),
      'available', (v_consume_result->>'available')::INTEGER,
      'required', v_cost
    );
  END IF;
END;
$$;

-- Update get_credit_service_cost to work with the new system
CREATE OR REPLACE FUNCTION get_credit_service_cost(
  p_user_id UUID,
  p_service_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service RECORD;
  v_base_cost INTEGER;
  v_effective_cost INTEGER;
  v_has_track_discount BOOLEAN := FALSE;
BEGIN
  -- Get the service details
  SELECT cs.*, f.key as feature_key
  INTO v_service
  FROM credit_services cs
  LEFT JOIN features f ON cs.feature_id = f.id
  WHERE cs.id = p_service_id AND cs.is_active = true;
  
  IF v_service IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  v_base_cost := v_service.credit_cost;
  v_effective_cost := v_service.credit_cost;
  
  -- Check for track discount
  IF v_service.track_id IS NOT NULL AND v_service.track_discounted_cost IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM user_tracks
      WHERE user_id = p_user_id
      AND track_id = v_service.track_id
      AND status = 'active'
    ) THEN
      v_effective_cost := v_service.track_discounted_cost;
      v_has_track_discount := TRUE;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'found', true,
    'service_id', v_service.id,
    'service_name', v_service.name,
    'base_cost', v_base_cost,
    'effective_cost', v_effective_cost,
    'has_track_discount', v_has_track_discount,
    'category', v_service.category,
    'feature_key', v_service.feature_key
  );
END;
$$;