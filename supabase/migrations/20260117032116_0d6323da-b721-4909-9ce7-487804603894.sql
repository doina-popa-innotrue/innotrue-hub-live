-- =====================================================
-- CONSOLIDATE RESOURCE USAGE INTO CREDIT SYSTEM
-- Resources now consume credits instead of quota tracking
-- =====================================================

-- 1. Add credit_cost to resource_library
ALTER TABLE public.resource_library 
ADD COLUMN IF NOT EXISTS credit_cost integer DEFAULT 1;

-- Add comment explaining the field
COMMENT ON COLUMN public.resource_library.credit_cost IS 
  'Number of credits to consume when accessing this resource. NULL or 0 means free access.';

-- 2. Create a function to consume resource credits
CREATE OR REPLACE FUNCTION public.consume_resource_credit(
  p_user_id uuid,
  p_resource_id uuid,
  p_org_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_credit_cost integer;
  v_resource_title text;
  v_result jsonb;
BEGIN
  -- Verify caller matches user_id
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get resource credit cost
  SELECT credit_cost, title INTO v_credit_cost, v_resource_title
  FROM public.resource_library
  WHERE id = p_resource_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resource not found');
  END IF;

  -- If free resource, allow access without consuming credits
  IF v_credit_cost IS NULL OR v_credit_cost = 0 THEN
    RETURN jsonb_build_object(
      'success', true, 
      'free', true,
      'credits_consumed', 0,
      'message', 'Free resource - no credits required'
    );
  END IF;

  -- Consume credits using the unified FIFO function
  v_result := public.consume_credits_fifo(
    p_user_id := p_user_id,
    p_amount := v_credit_cost,
    p_org_id := p_org_id,
    p_service_key := 'resource_access',
    p_reference_id := p_resource_id,
    p_notes := 'Resource: ' || v_resource_title
  );

  -- Return result with resource context
  RETURN jsonb_build_object(
    'success', (v_result->>'success')::boolean,
    'free', false,
    'credits_consumed', CASE WHEN (v_result->>'success')::boolean THEN v_credit_cost ELSE 0 END,
    'remaining', v_result->'remaining',
    'error', v_result->>'error'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.consume_resource_credit(uuid, uuid, uuid) TO authenticated;

-- 3. Create a view for resource access with credit info
CREATE OR REPLACE VIEW public.resource_credit_summary AS
SELECT 
  r.id,
  r.canonical_id,
  r.title,
  r.resource_type,
  r.is_consumable,
  r.credit_cost,
  CASE 
    WHEN r.is_consumable AND (r.credit_cost IS NULL OR r.credit_cost = 0) THEN 'free'
    WHEN r.is_consumable THEN 'paid'
    ELSE 'unlimited'
  END as access_type
FROM public.resource_library r
WHERE r.is_active = true;

-- Grant select on view
GRANT SELECT ON public.resource_credit_summary TO authenticated;

-- 4. Deprecate old functions with comments
COMMENT ON FUNCTION public.increment_resource_usage(uuid, uuid) IS 
  '@deprecated Use consume_resource_credit instead. This function is maintained for backwards compatibility.';

COMMENT ON TABLE public.resource_usage_tracking IS 
  '@deprecated Resource consumption is now tracked through credit_consumption_log. This table is maintained for backwards compatibility and historical data.';

COMMENT ON TABLE public.plan_resource_limits IS 
  '@deprecated Resource access now uses credit_cost on resource_library. Plan grants resource credits through plan_credit_allocations. This table is maintained for backwards compatibility.';

-- 5. Create helper to check resource access before consuming
CREATE OR REPLACE FUNCTION public.check_resource_access(
  p_user_id uuid,
  p_resource_id uuid,
  p_org_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_credit_cost integer;
  v_is_consumable boolean;
  v_summary jsonb;
  v_available integer;
BEGIN
  -- Get resource info
  SELECT credit_cost, is_consumable INTO v_credit_cost, v_is_consumable
  FROM public.resource_library
  WHERE id = p_resource_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_access', false, 'error', 'Resource not found');
  END IF;

  -- Free or non-consumable resources always accessible
  IF NOT v_is_consumable OR v_credit_cost IS NULL OR v_credit_cost = 0 THEN
    RETURN jsonb_build_object(
      'has_access', true, 
      'cost', 0,
      'is_free', true
    );
  END IF;

  -- Get user's credit balance
  IF p_org_id IS NOT NULL THEN
    v_summary := public.get_org_credit_summary_v2(p_org_id);
  ELSE
    v_summary := public.get_user_credit_summary_v2(p_user_id);
  END IF;

  v_available := COALESCE((v_summary->>'total_available')::integer, 0);

  RETURN jsonb_build_object(
    'has_access', v_available >= v_credit_cost,
    'cost', v_credit_cost,
    'is_free', false,
    'available_credits', v_available,
    'would_remain', GREATEST(0, v_available - v_credit_cost)
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_resource_access(uuid, uuid, uuid) TO authenticated;