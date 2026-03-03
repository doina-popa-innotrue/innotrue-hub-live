-- Diagnostic RPC: debug_resource_access
-- Returns which can_access_resource() checks pass/fail for a given user + resource.
-- Usage: SELECT * FROM debug_resource_access('USER_UUID', 'RESOURCE_UUID');
-- Safe to keep in production — admin-only, read-only, no side effects.

CREATE OR REPLACE FUNCTION public.debug_resource_access(
  _user_id UUID,
  _resource_id UUID
)
RETURNS TABLE (
  check_name TEXT,
  passed BOOLEAN,
  details TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _visibility TEXT;
  _min_plan_tier INTEGER;
  _feature_key TEXT;
  _is_admin BOOLEAN;
BEGIN
  -- Only admins can call this function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN QUERY SELECT 'error'::TEXT, FALSE, 'Only admins can call this function'::TEXT;
    RETURN;
  END IF;

  -- Check resource exists
  SELECT visibility, min_plan_tier, feature_key
  INTO _visibility, _min_plan_tier, _feature_key
  FROM public.resource_library
  WHERE id = _resource_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'resource_lookup'::TEXT, FALSE, 'Resource not found'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'resource_lookup'::TEXT, TRUE,
    format('visibility=%s, min_plan_tier=%s, feature_key=%s', _visibility, _min_plan_tier, _feature_key)::TEXT;

  -- Check admin
  _is_admin := public.has_role(_user_id, 'admin');
  RETURN QUERY SELECT 'is_admin'::TEXT, _is_admin, format('has_role(admin)=%s', _is_admin)::TEXT;

  -- Final result
  RETURN QUERY SELECT 'can_access_resource_result'::TEXT,
    public.can_access_resource(_user_id, _resource_id),
    'Final function result'::TEXT;

  -- Check 1: Program enrollment with tier
  RETURN QUERY SELECT 'check_1_program_tiers'::TEXT,
    EXISTS (
      SELECT 1
      FROM public.resource_library_program_tiers rpt
      JOIN public.client_enrollments ce ON ce.program_id = rpt.program_id
      JOIN public.program_plans pp ON pp.id = ce.program_plan_id
      WHERE rpt.resource_id = _resource_id
        AND ce.client_user_id = _user_id
        AND ce.status IN ('active', 'completed')
        AND (rpt.min_tier_index IS NULL OR rpt.min_tier_index = 0 OR pp.tier_level >= rpt.min_tier_index)
    ),
    (SELECT string_agg(format('program=%s tier=%s', rpt.program_id, rpt.min_tier_index), ', ')
     FROM resource_library_program_tiers rpt WHERE rpt.resource_id = _resource_id)::TEXT;

  -- Check 2: Legacy program link
  RETURN QUERY SELECT 'check_2_program_link'::TEXT,
    EXISTS (
      SELECT 1
      FROM public.resource_library_programs rlp
      JOIN public.client_enrollments ce ON ce.program_id = rlp.program_id
      WHERE rlp.resource_id = _resource_id
        AND ce.client_user_id = _user_id
        AND ce.status IN ('active', 'completed')
    ),
    format('program_links=%s, enrollments=%s',
      (SELECT count(*) FROM resource_library_programs WHERE resource_id = _resource_id),
      (SELECT string_agg(format('%s(%s)', ce.program_id, ce.status), ', ')
       FROM client_enrollments ce WHERE ce.client_user_id = _user_id)
    )::TEXT;

  -- Check 7: Personalised content
  RETURN QUERY SELECT 'check_7_personalised'::TEXT,
    EXISTS (
      SELECT 1
      FROM public.module_client_content_resources mccr
      JOIN public.module_client_content mcc ON mcc.id = mccr.module_client_content_id
      WHERE mccr.resource_id = _resource_id
        AND mcc.user_id = _user_id
    ),
    format('content_resource_rows=%s',
      (SELECT count(*) FROM module_client_content_resources mccr
       JOIN module_client_content mcc ON mcc.id = mccr.module_client_content_id
       WHERE mccr.resource_id = _resource_id AND mcc.user_id = _user_id)
    )::TEXT;

  RETURN;
END;
$$;
