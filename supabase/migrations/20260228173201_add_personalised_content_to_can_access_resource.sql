-- Add Check 7 to can_access_resource(): grant access when a resource is
-- assigned to a client via personalised module content (module_client_content_resources).
-- Without this, the FK join from module_client_content_resources → resource_library
-- returns NULL on the client side because the RLS policy blocks access.

CREATE OR REPLACE FUNCTION public.can_access_resource(
  _user_id UUID,
  _resource_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _visibility TEXT;
  _min_plan_tier INTEGER;
  _feature_key TEXT;
  _user_plan_tier INTEGER;
BEGIN
  -- Get resource visibility settings
  SELECT visibility, min_plan_tier, feature_key
  INTO _visibility, _min_plan_tier, _feature_key
  FROM public.resource_library
  WHERE id = _resource_id;

  -- If resource not found, deny access
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Admins always have access
  IF public.has_role(_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Private resources: admin only (already checked above)
  IF _visibility = 'private' THEN
    RETURN FALSE;
  END IF;

  -- Public resources: all authenticated users
  IF _visibility = 'public' THEN
    RETURN TRUE;
  END IF;

  -- Enrolled visibility: check various access paths
  IF _visibility = 'enrolled' THEN
    -- Check 1: Program enrollment with tier (active or completed = forever access)
    IF EXISTS (
      SELECT 1
      FROM public.resource_library_program_tiers rpt
      JOIN public.client_enrollments ce ON ce.program_id = rpt.program_id
      JOIN public.program_plans pp ON pp.id = ce.program_plan_id
      WHERE rpt.resource_id = _resource_id
        AND ce.client_user_id = _user_id
        AND ce.status IN ('active', 'completed')
        AND (rpt.min_tier_index IS NULL OR rpt.min_tier_index = 0 OR pp.tier_index >= rpt.min_tier_index)
    ) THEN
      RETURN TRUE;
    END IF;

    -- Check 2: Legacy program link (resource_library_programs without tier requirement)
    IF EXISTS (
      SELECT 1
      FROM public.resource_library_programs rlp
      JOIN public.client_enrollments ce ON ce.program_id = rlp.program_id
      WHERE rlp.resource_id = _resource_id
        AND ce.client_user_id = _user_id
        AND ce.status IN ('active', 'completed')
    ) THEN
      RETURN TRUE;
    END IF;

    -- Check 3: Subscription tier requirement
    IF _min_plan_tier IS NOT NULL THEN
      SELECT COALESCE(p.tier_level, 0)
      INTO _user_plan_tier
      FROM public.profiles pr
      LEFT JOIN public.plans p ON p.id = pr.plan_id
      WHERE pr.id = _user_id;

      IF _user_plan_tier >= _min_plan_tier THEN
        RETURN TRUE;
      END IF;
    END IF;

    -- Check 4: Feature key entitlement
    IF _feature_key IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.user_feature_entitlements ufe
        JOIN public.features f ON f.id = ufe.feature_id
        WHERE ufe.user_id = _user_id
          AND f.key = _feature_key
          AND ufe.is_active = TRUE
      ) THEN
        RETURN TRUE;
      END IF;
    END IF;

    -- Check 5: Direct assignment via development items
    IF EXISTS (
      SELECT 1
      FROM public.development_item_resources dir
      JOIN public.development_items di ON di.id = dir.development_item_id
      WHERE dir.resource_id = _resource_id
        AND di.user_id = _user_id
    ) THEN
      RETURN TRUE;
    END IF;

    -- Check 6: Direct assignment via module content
    IF EXISTS (
      SELECT 1
      FROM public.module_content_resources mcr
      JOIN public.module_content mc ON mc.id = mcr.module_content_id
      JOIN public.program_modules pm ON pm.id = mc.module_id
      JOIN public.client_enrollments ce ON ce.program_id = pm.program_id
      WHERE mcr.resource_id = _resource_id
        AND ce.client_user_id = _user_id
        AND ce.status IN ('active', 'completed')
    ) THEN
      RETURN TRUE;
    END IF;

    -- Check 7: Direct assignment via personalised module content
    IF EXISTS (
      SELECT 1
      FROM public.module_client_content_resources mccr
      JOIN public.module_client_content mcc ON mcc.id = mccr.module_client_content_id
      WHERE mccr.resource_id = _resource_id
        AND mcc.user_id = _user_id
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;
