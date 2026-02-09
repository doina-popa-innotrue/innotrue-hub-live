-- Function to get credit service by feature key
CREATE OR REPLACE FUNCTION public.get_credit_service_by_feature(
  p_user_id uuid,
  p_feature_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service record;
  v_feature_id uuid;
  v_effective_cost numeric;
  v_user_track_id uuid;
BEGIN
  -- Find the feature ID
  SELECT id INTO v_feature_id
  FROM features
  WHERE key = p_feature_key AND is_active = true;
  
  IF v_feature_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  -- Find credit service linked to this feature
  SELECT * INTO v_service
  FROM credit_services
  WHERE feature_id = v_feature_id AND is_active = true
  LIMIT 1;
  
  IF v_service IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  -- Check for track discount
  v_effective_cost := v_service.credit_cost;
  
  IF v_service.track_id IS NOT NULL AND v_service.track_discounted_cost IS NOT NULL THEN
    -- Check if user is in the track
    SELECT ut.track_id INTO v_user_track_id
    FROM user_tracks ut
    WHERE ut.user_id = p_user_id 
      AND ut.track_id = v_service.track_id
      AND ut.is_active = true
    LIMIT 1;
    
    IF v_user_track_id IS NOT NULL THEN
      v_effective_cost := v_service.track_discounted_cost;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'found', true,
    'service_id', v_service.id,
    'service_name', v_service.name,
    'base_cost', v_service.credit_cost,
    'effective_cost', v_effective_cost,
    'has_track_discount', v_user_track_id IS NOT NULL,
    'category', v_service.category
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_credit_service_by_feature(uuid, text) TO authenticated;