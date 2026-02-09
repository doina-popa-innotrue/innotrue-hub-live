
-- Function to check if all required scenarios for an enrollment are completed
CREATE OR REPLACE FUNCTION public.check_scenario_certification_requirements(
  p_enrollment_id UUID
)
RETURNS TABLE (
  all_requirements_met BOOLEAN,
  total_required INTEGER,
  completed_count INTEGER,
  missing_scenarios JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_id UUID;
  v_user_id UUID;
  v_total_required INTEGER := 0;
  v_completed_count INTEGER := 0;
  v_missing JSONB := '[]'::jsonb;
BEGIN
  -- Get the program and user from enrollment
  SELECT ce.program_id, ce.client_user_id
  INTO v_program_id, v_user_id
  FROM client_enrollments ce
  WHERE ce.id = p_enrollment_id;

  IF v_program_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, '[]'::jsonb;
    RETURN;
  END IF;

  -- Find all required scenarios across all modules in the program
  WITH required_scenarios AS (
    SELECT 
      ms.template_id,
      st.title AS scenario_title,
      pm.id AS module_id,
      pm.title AS module_title
    FROM module_scenarios ms
    JOIN program_modules pm ON pm.id = ms.module_id
    JOIN scenario_templates st ON st.id = ms.template_id
    WHERE pm.program_id = v_program_id
      AND pm.is_active = true
      AND ms.is_required_for_certification = true
      AND st.is_active = true
  ),
  completed_scenarios AS (
    SELECT DISTINCT sa.template_id
    FROM scenario_assignments sa
    WHERE sa.user_id = v_user_id
      AND sa.enrollment_id = p_enrollment_id
      AND sa.status = 'evaluated'
  )
  SELECT 
    COUNT(*)::INTEGER,
    COUNT(cs.template_id)::INTEGER,
    jsonb_agg(
      jsonb_build_object(
        'template_id', rs.template_id,
        'scenario_title', rs.scenario_title,
        'module_title', rs.module_title
      )
    ) FILTER (WHERE cs.template_id IS NULL)
  INTO v_total_required, v_completed_count, v_missing
  FROM required_scenarios rs
  LEFT JOIN completed_scenarios cs ON cs.template_id = rs.template_id;

  -- Handle null in missing array
  IF v_missing IS NULL THEN
    v_missing := '[]'::jsonb;
  END IF;

  RETURN QUERY SELECT 
    (v_completed_count >= v_total_required),
    v_total_required,
    v_completed_count,
    v_missing;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_scenario_certification_requirements(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.check_scenario_certification_requirements IS 
  'Checks if all required scenario assessments for an enrollment have been completed and evaluated. Returns completion status and list of missing scenarios.';
