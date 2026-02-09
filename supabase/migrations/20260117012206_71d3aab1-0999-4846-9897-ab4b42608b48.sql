-- =============================================================================
-- CREDIT SERVICES TABLE
-- Central registry for anything that costs credits (except programs)
-- =============================================================================

CREATE TABLE public.credit_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  credit_cost INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  
  -- Optional links for access gating and specialization
  feature_id UUID REFERENCES public.features(id) ON DELETE SET NULL,
  track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  
  -- Optional link to specific entity (for connecting to existing things)
  linked_entity_type TEXT, -- 'session_type', 'assessment', 'resource', etc.
  linked_entity_id UUID,
  
  -- Track discount (if track_id is set, this overrides credit_cost for that track)
  track_discounted_cost INTEGER,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_services ENABLE ROW LEVEL SECURITY;

-- Everyone can read active credit services (needed for pricing display)
CREATE POLICY "Anyone can view active credit services"
  ON public.credit_services FOR SELECT
  USING (is_active = true);

-- Admins can manage credit services
CREATE POLICY "Admins can manage credit services"
  ON public.credit_services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Index for common lookups
CREATE INDEX idx_credit_services_category ON public.credit_services(category);
CREATE INDEX idx_credit_services_feature ON public.credit_services(feature_id);
CREATE INDEX idx_credit_services_linked ON public.credit_services(linked_entity_type, linked_entity_id);

-- Trigger for updated_at
CREATE TRIGGER update_credit_services_updated_at
  BEFORE UPDATE ON public.credit_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- CONSUME CREDIT SERVICE FUNCTION
-- Handles consumption of any credit service with optional track discounts
-- =============================================================================

CREATE OR REPLACE FUNCTION public.consume_credit_service(
  p_user_id UUID,
  p_service_id UUID,
  p_action_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service credit_services%ROWTYPE;
  v_user_track_id UUID;
  v_cost INTEGER;
  v_balance user_credit_balances%ROWTYPE;
  v_has_feature_access BOOLEAN := true;
BEGIN
  -- Get the credit service
  SELECT * INTO v_service
  FROM credit_services
  WHERE id = p_service_id AND is_active = true;
  
  IF v_service.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit service not found or inactive');
  END IF;
  
  -- Check feature access if linked to a feature
  IF v_service.feature_id IS NOT NULL THEN
    -- Check if user has access via plan features, program plan features, or add-on features
    SELECT EXISTS (
      -- Check plan features
      SELECT 1 FROM profiles p
      JOIN plan_features pf ON pf.plan_id = p.plan_id
      WHERE p.id = p_user_id AND pf.feature_id = v_service.feature_id AND pf.is_enabled = true
      UNION
      -- Check program plan features
      SELECT 1 FROM client_enrollments ce
      JOIN program_plan_features ppf ON ppf.program_plan_id = ce.program_plan_id
      WHERE ce.client_user_id = p_user_id 
        AND ce.status = 'active'
        AND ppf.feature_id = v_service.feature_id 
        AND ppf.is_enabled = true
      UNION
      -- Check add-on features
      SELECT 1 FROM user_add_ons ua
      JOIN add_on_features af ON af.add_on_id = ua.add_on_id
      WHERE ua.user_id = p_user_id 
        AND ua.is_active = true
        AND af.feature_id = v_service.feature_id
    ) INTO v_has_feature_access;
    
    IF NOT v_has_feature_access THEN
      RETURN jsonb_build_object('success', false, 'error', 'You do not have access to this service');
    END IF;
  END IF;
  
  -- Get user's active track (if any)
  SELECT track_id INTO v_user_track_id
  FROM user_tracks
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;
  
  -- Determine cost (apply track discount if applicable)
  IF v_service.track_id IS NOT NULL 
     AND v_user_track_id = v_service.track_id 
     AND v_service.track_discounted_cost IS NOT NULL THEN
    v_cost := v_service.track_discounted_cost;
  ELSE
    v_cost := v_service.credit_cost;
  END IF;
  
  -- Get user's credit balance
  SELECT * INTO v_balance
  FROM user_credit_balances
  WHERE user_id = p_user_id;
  
  IF v_balance.user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit balance found');
  END IF;
  
  IF v_balance.available_credits < v_cost THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient credits. Required: %s, Available: %s', v_cost, v_balance.available_credits)
    );
  END IF;
  
  -- Deduct credits
  UPDATE user_credit_balances
  SET available_credits = available_credits - v_cost,
      total_consumed = total_consumed + v_cost,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log the transaction
  INSERT INTO user_credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    action_type,
    action_reference_id,
    description
  ) VALUES (
    p_user_id,
    'consumption',
    -v_cost,
    v_balance.available_credits - v_cost,
    'credit_service',
    p_service_id,
    COALESCE(p_notes, format('Used service: %s', v_service.name))
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_consumed', v_cost,
    'balance_after', v_balance.available_credits - v_cost,
    'service_name', v_service.name
  );
END;
$$;

-- =============================================================================
-- GET CREDIT SERVICE COST FUNCTION
-- Returns the effective cost for a user (considering track discounts)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_credit_service_cost(
  p_user_id UUID,
  p_service_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service credit_services%ROWTYPE;
  v_user_track_id UUID;
  v_cost INTEGER;
  v_has_discount BOOLEAN := false;
BEGIN
  -- Get the credit service
  SELECT * INTO v_service
  FROM credit_services
  WHERE id = p_service_id AND is_active = true;
  
  IF v_service.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  -- Get user's active track
  SELECT track_id INTO v_user_track_id
  FROM user_tracks
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;
  
  -- Determine cost
  IF v_service.track_id IS NOT NULL 
     AND v_user_track_id = v_service.track_id 
     AND v_service.track_discounted_cost IS NOT NULL THEN
    v_cost := v_service.track_discounted_cost;
    v_has_discount := true;
  ELSE
    v_cost := v_service.credit_cost;
  END IF;
  
  RETURN jsonb_build_object(
    'found', true,
    'service_id', v_service.id,
    'service_name', v_service.name,
    'base_cost', v_service.credit_cost,
    'effective_cost', v_cost,
    'has_track_discount', v_has_discount,
    'category', v_service.category
  );
END;
$$;