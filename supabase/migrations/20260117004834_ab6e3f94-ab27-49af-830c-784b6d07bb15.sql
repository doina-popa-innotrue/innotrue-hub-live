-- =====================================================
-- ENROLLMENT CREDIT INTEGRATION
-- =====================================================

-- Function to consume credits when enrolling via org
CREATE OR REPLACE FUNCTION public.consume_enrollment_credits(
  p_organization_id UUID,
  p_program_id UUID,
  p_user_ids UUID[],
  p_enrolled_by UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_cost INTEGER;
  v_total_cost INTEGER;
  v_balance RECORD;
  v_user_id UUID;
  v_enrollment_ids UUID[] := ARRAY[]::UUID[];
  v_enrollment_id UUID;
BEGIN
  -- Get program credit cost
  SELECT credit_cost INTO v_program_cost
  FROM programs
  WHERE id = p_program_id;
  
  -- If program has no credit cost, enrollments are free
  IF v_program_cost IS NULL OR v_program_cost = 0 THEN
    -- Create enrollments without consuming credits
    FOREACH v_user_id IN ARRAY p_user_ids LOOP
      INSERT INTO client_enrollments (
        client_user_id,
        program_id,
        status,
        start_date
      ) VALUES (
        v_user_id,
        p_program_id,
        'active',
        CURRENT_DATE
      )
      ON CONFLICT (client_user_id, program_id) DO NOTHING
      RETURNING id INTO v_enrollment_id;
      
      IF v_enrollment_id IS NOT NULL THEN
        v_enrollment_ids := array_append(v_enrollment_ids, v_enrollment_id);
      END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
      'success', true,
      'free_enrollment', true,
      'enrolled_count', array_length(v_enrollment_ids, 1),
      'enrollment_ids', v_enrollment_ids
    );
  END IF;
  
  -- Calculate total cost
  v_total_cost := v_program_cost * array_length(p_user_ids, 1);
  
  -- Check org balance
  SELECT * INTO v_balance
  FROM org_credit_balances
  WHERE organization_id = p_organization_id
  FOR UPDATE;
  
  IF v_balance IS NULL OR v_balance.available_credits < v_total_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'required', v_total_cost,
      'available', COALESCE(v_balance.available_credits, 0)
    );
  END IF;
  
  -- Consume credits
  UPDATE org_credit_balances
  SET available_credits = available_credits - v_total_cost,
      total_consumed = total_consumed + v_total_cost,
      updated_at = now()
  WHERE organization_id = p_organization_id;
  
  -- Log the transaction
  INSERT INTO org_credit_transactions (
    organization_id,
    transaction_type,
    amount,
    balance_after,
    description,
    performed_by
  ) VALUES (
    p_organization_id,
    'enrollment',
    -v_total_cost,
    v_balance.available_credits - v_total_cost,
    format('Enrolled %s user(s) in program', array_length(p_user_ids, 1)),
    p_enrolled_by
  );
  
  -- Create enrollments
  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    INSERT INTO client_enrollments (
      client_user_id,
      program_id,
      status,
      start_date
    ) VALUES (
      v_user_id,
      p_program_id,
      'active',
      CURRENT_DATE
    )
    ON CONFLICT (client_user_id, program_id) DO NOTHING
    RETURNING id INTO v_enrollment_id;
    
    IF v_enrollment_id IS NOT NULL THEN
      v_enrollment_ids := array_append(v_enrollment_ids, v_enrollment_id);
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_consumed', v_total_cost,
    'balance_after', v_balance.available_credits - v_total_cost,
    'enrolled_count', array_length(v_enrollment_ids, 1),
    'enrollment_ids', v_enrollment_ids
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.consume_enrollment_credits TO authenticated;

-- Function for individual user to enroll using their own credits
CREATE OR REPLACE FUNCTION public.enroll_with_user_credits(
  p_user_id UUID,
  p_program_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program RECORD;
  v_balance RECORD;
  v_enrollment_id UUID;
  v_existing_enrollment UUID;
BEGIN
  -- Get program details
  SELECT * INTO v_program
  FROM programs
  WHERE id = p_program_id AND is_active = true;
  
  IF v_program IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'program_not_found'
    );
  END IF;
  
  -- Check for existing enrollment
  SELECT id INTO v_existing_enrollment
  FROM client_enrollments
  WHERE client_user_id = p_user_id AND program_id = p_program_id;
  
  IF v_existing_enrollment IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_enrolled',
      'enrollment_id', v_existing_enrollment
    );
  END IF;
  
  -- If program is free, enroll directly
  IF v_program.credit_cost IS NULL OR v_program.credit_cost = 0 THEN
    INSERT INTO client_enrollments (
      client_user_id,
      program_id,
      status,
      start_date
    ) VALUES (
      p_user_id,
      p_program_id,
      'active',
      CURRENT_DATE
    )
    RETURNING id INTO v_enrollment_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'free_enrollment', true,
      'enrollment_id', v_enrollment_id
    );
  END IF;
  
  -- Check user balance
  SELECT * INTO v_balance
  FROM user_credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_balance IS NULL OR v_balance.available_credits < v_program.credit_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'required', v_program.credit_cost,
      'available', COALESCE(v_balance.available_credits, 0)
    );
  END IF;
  
  -- Consume credits
  UPDATE user_credit_balances
  SET available_credits = available_credits - v_program.credit_cost,
      total_consumed = total_consumed + v_program.credit_cost,
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
    -v_program.credit_cost,
    v_balance.available_credits - v_program.credit_cost,
    'enrollment',
    p_program_id,
    format('Enrolled in program: %s', v_program.name)
  );
  
  -- Create enrollment
  INSERT INTO client_enrollments (
    client_user_id,
    program_id,
    status,
    start_date
  ) VALUES (
    p_user_id,
    p_program_id,
    'active',
    CURRENT_DATE
  )
  RETURNING id INTO v_enrollment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_consumed', v_program.credit_cost,
    'balance_after', v_balance.available_credits - v_program.credit_cost,
    'enrollment_id', v_enrollment_id
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.enroll_with_user_credits TO authenticated;

-- Update get_user_credit_summary to include program credits from enrollments
CREATE OR REPLACE FUNCTION public.get_user_credit_summary(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_plan RECORD;
  v_plan_credits INTEGER := 0;
  v_program_credits INTEGER := 0;
  v_expiring_soon INTEGER := 0;
BEGIN
  -- Get user balance
  SELECT * INTO v_balance
  FROM user_credit_balances
  WHERE user_id = p_user_id;

  -- Get user's plan with credits
  SELECT pl.* INTO v_plan
  FROM profiles p
  JOIN plans pl ON p.plan_id = pl.id
  WHERE p.id = p_user_id
    AND pl.credit_allowance IS NOT NULL;

  IF v_plan IS NOT NULL THEN
    v_plan_credits := v_plan.credit_allowance;
  END IF;
  
  -- Get program credits from active enrollments with program plans that have credit allowances
  SELECT COALESCE(SUM(pp.credit_allowance), 0) INTO v_program_credits
  FROM client_enrollments ce
  JOIN program_plans pp ON ce.program_plan_id = pp.id
  WHERE ce.client_user_id = p_user_id
    AND ce.status = 'active'
    AND pp.credit_allowance IS NOT NULL;

  -- Calculate credits expiring soon
  SELECT COALESCE(SUM(credits_purchased), 0) INTO v_expiring_soon
  FROM user_credit_purchases
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND expires_at IS NOT NULL
    AND expires_at <= now() + interval '30 days'
    AND expires_at > now();

  RETURN jsonb_build_object(
    'available_credits', COALESCE(v_balance.available_credits, 0),
    'total_received', COALESCE(v_balance.total_received, 0),
    'total_consumed', COALESCE(v_balance.total_consumed, 0),
    'reserved_credits', COALESCE(v_balance.reserved_credits, 0),
    'expiring_soon', v_expiring_soon,
    'has_credit_plan', v_plan IS NOT NULL,
    'plan_name', v_plan.name,
    'plan_credit_allowance', v_plan_credits,
    'program_credit_allowance', v_program_credits,
    'total_allowance', v_plan_credits + v_program_credits
  );
END;
$$;

-- Add credit_allowance to program_plans for program-specific credits
ALTER TABLE public.program_plans ADD COLUMN IF NOT EXISTS credit_allowance INTEGER DEFAULT NULL;
COMMENT ON COLUMN public.program_plans.credit_allowance IS 'Number of credits included with this program plan';