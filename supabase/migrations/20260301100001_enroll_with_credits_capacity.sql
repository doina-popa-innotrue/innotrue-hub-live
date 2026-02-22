-- ============================================================================
-- enroll_with_credits: Add capacity enforcement + enrollment source tracking
-- ============================================================================
-- Adds 4 new parameters (all with defaults, backward compatible):
--   p_force             — skip capacity checks (admin override)
--   p_enrollment_source — attribution: self, admin, enrollment_code, etc.
--   p_referred_by       — who referred/promoted
--   p_referral_note     — free text context
-- ============================================================================

-- Drop old overloads to avoid ambiguity
DROP FUNCTION IF EXISTS public.enroll_with_credits(uuid, uuid, text, uuid, numeric, integer, integer, text);
DROP FUNCTION IF EXISTS public.enroll_with_credits(uuid, uuid, text, uuid, numeric, integer, integer, text, uuid);

CREATE OR REPLACE FUNCTION public.enroll_with_credits(
  p_client_user_id uuid,
  p_program_id uuid,
  p_tier text DEFAULT NULL,
  p_program_plan_id uuid DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL,
  p_original_credit_cost integer DEFAULT NULL,
  p_final_credit_cost integer DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_cohort_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false,
  p_enrollment_source text DEFAULT NULL,
  p_referred_by uuid DEFAULT NULL,
  p_referral_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id uuid;
  v_consume_result jsonb;
  v_prog_check jsonb;
  v_cohort_check jsonb;
BEGIN
  -- Step 0a: Program-level capacity check (unless forced)
  IF NOT COALESCE(p_force, false) THEN
    v_prog_check := public.check_program_capacity(p_program_id);
    IF v_prog_check->>'has_capacity' IS NOT NULL
       AND NOT (v_prog_check->>'has_capacity')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Program is at full capacity (%s/%s)',
          v_prog_check->>'enrolled_count', v_prog_check->>'capacity'),
        'enrollment_id', null,
        'credit_details', null
      );
    END IF;
  END IF;

  -- Step 0b: Cohort-level capacity check (unless forced)
  IF p_cohort_id IS NOT NULL AND NOT COALESCE(p_force, false) THEN
    v_cohort_check := public.check_cohort_capacity(p_cohort_id);
    IF NOT (v_cohort_check->>'has_capacity')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Cohort is at full capacity (%s/%s)',
          v_cohort_check->>'enrolled_count', v_cohort_check->>'capacity'),
        'enrollment_id', null,
        'credit_details', null
      );
    END IF;
  END IF;

  -- Step 1: Consume credits if cost > 0
  IF COALESCE(p_final_credit_cost, 0) > 0 THEN
    v_consume_result := public.consume_credits_fifo(
      p_owner_type := 'user',
      p_owner_id := p_client_user_id,
      p_amount := p_final_credit_cost,
      p_feature_key := NULL,
      p_action_type := 'program_enrollment',
      p_action_reference_id := p_program_id::text,
      p_description := COALESCE(p_description, 'Program enrollment')
    );

    -- If credit consumption failed, abort — nothing has been committed yet
    IF NOT (v_consume_result->>'success')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', COALESCE(v_consume_result->>'error', 'Credit consumption failed'),
        'enrollment_id', null,
        'credit_details', v_consume_result
      );
    END IF;
  END IF;

  -- Step 2: Create enrollment (same transaction — auto-rolls back on failure)
  INSERT INTO client_enrollments (
    client_user_id,
    program_id,
    status,
    tier,
    program_plan_id,
    discount_percent,
    original_credit_cost,
    final_credit_cost,
    cohort_id,
    enrollment_source,
    referred_by,
    referral_note
  ) VALUES (
    p_client_user_id,
    p_program_id,
    'active',
    p_tier,
    p_program_plan_id,
    p_discount_percent,
    p_original_credit_cost,
    p_final_credit_cost,
    p_cohort_id,
    p_enrollment_source,
    p_referred_by,
    p_referral_note
  )
  RETURNING id INTO v_enrollment_id;

  -- Step 3: Link consumption log entries to the enrollment
  IF COALESCE(p_final_credit_cost, 0) > 0 THEN
    UPDATE credit_consumption_log
    SET action_reference_id = v_enrollment_id::text
    WHERE action_reference_id = p_program_id::text
      AND action_type = 'program_enrollment'
      AND user_id = p_client_user_id
      AND consumed_at >= now() - interval '5 seconds';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'credit_details', COALESCE(v_consume_result, '{}'::jsonb)
  );

EXCEPTION WHEN OTHERS THEN
  -- Any failure (including enrollment insert) rolls back EVERYTHING
  -- including the credit consumption from step 1
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'enrollment_id', null,
    'credit_details', null
  );
END;
$$;

-- Grant with full 13-param signature
GRANT EXECUTE ON FUNCTION public.enroll_with_credits(uuid, uuid, text, uuid, numeric, integer, integer, text, uuid, boolean, text, uuid, text) TO authenticated;
