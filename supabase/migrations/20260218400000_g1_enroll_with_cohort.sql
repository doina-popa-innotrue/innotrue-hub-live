-- G1: Add p_cohort_id parameter to enroll_with_credits RPC
-- Allows admin to assign a client to a cohort during enrollment.
-- Backward compatible: p_cohort_id defaults to NULL.

CREATE OR REPLACE FUNCTION public.enroll_with_credits(
  p_client_user_id uuid,
  p_program_id uuid,
  p_tier text DEFAULT NULL,
  p_program_plan_id uuid DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL,
  p_original_credit_cost integer DEFAULT NULL,
  p_final_credit_cost integer DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_cohort_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id uuid;
  v_consume_result jsonb;
BEGIN
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
    cohort_id
  ) VALUES (
    p_client_user_id,
    p_program_id,
    'active',
    p_tier,
    p_program_plan_id,
    p_discount_percent,
    p_original_credit_cost,
    p_final_credit_cost,
    p_cohort_id
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

-- Grant remains the same (already granted to authenticated)
GRANT EXECUTE ON FUNCTION public.enroll_with_credits TO authenticated;
