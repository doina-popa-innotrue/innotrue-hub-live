-- Admin data cleanup: list matching records for inspection before deletion
-- Reuses the same CTE matching logic as admin_data_cleanup_preview/execute
-- but returns actual record rows with JOINed display names + pagination.

CREATE OR REPLACE FUNCTION admin_data_cleanup_list_records(
  p_entity_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_program_id UUID DEFAULT NULL,
  p_created_before TIMESTAMPTZ DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Admin-only guard
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  CASE p_entity_type

  -- =========================================================================
  -- SCENARIO ASSIGNMENTS
  -- =========================================================================
  WHEN 'scenario_assignments' THEN
    WITH matched AS (
      SELECT sa.id
      FROM scenario_assignments sa
      LEFT JOIN client_enrollments ce ON sa.enrollment_id = ce.id
      WHERE (p_user_id IS NULL OR sa.user_id = p_user_id)
        AND (p_program_id IS NULL OR ce.program_id = p_program_id)
        AND (p_created_before IS NULL OR sa.created_at < p_created_before)
        AND (p_status IS NULL OR sa.status = p_status)
    )
    SELECT jsonb_build_object(
      'total_count', (SELECT count(*) FROM matched),
      'records', COALESCE((
        SELECT jsonb_agg(row_to_jsonb(r))
        FROM (
          SELECT sa.id, sa.user_id, sa.status, sa.attempt_number,
                 sa.created_at, sa.submitted_at, sa.evaluated_at,
                 st.title AS template_title,
                 pm.title AS module_title
          FROM scenario_assignments sa
          JOIN matched m ON sa.id = m.id
          LEFT JOIN scenario_templates st ON sa.template_id = st.id
          LEFT JOIN program_modules pm ON sa.module_id = pm.id
          ORDER BY sa.created_at DESC
          LIMIT p_limit OFFSET p_offset
        ) r
      ), '[]'::jsonb)
    ) INTO v_result;

  -- =========================================================================
  -- CAPABILITY SNAPSHOTS
  -- =========================================================================
  WHEN 'capability_snapshots' THEN
    WITH matched AS (
      SELECT cs.id
      FROM capability_snapshots cs
      WHERE (p_user_id IS NULL OR cs.user_id = p_user_id)
        AND (p_created_before IS NULL OR cs.created_at < p_created_before)
        AND (p_status IS NULL OR cs.status = p_status)
        AND (p_program_id IS NULL OR cs.enrollment_id IN (
          SELECT id FROM client_enrollments WHERE program_id = p_program_id
        ))
    )
    SELECT jsonb_build_object(
      'total_count', (SELECT count(*) FROM matched),
      'records', COALESCE((
        SELECT jsonb_agg(row_to_jsonb(r))
        FROM (
          SELECT cs.id, cs.user_id, cs.status, cs.is_self_assessment,
                 cs.evaluation_relationship, cs.created_at, cs.completed_at,
                 cs.evaluator_id,
                 ca.name AS assessment_name
          FROM capability_snapshots cs
          JOIN matched m ON cs.id = m.id
          LEFT JOIN capability_assessments ca ON cs.assessment_id = ca.id
          ORDER BY cs.created_at DESC
          LIMIT p_limit OFFSET p_offset
        ) r
      ), '[]'::jsonb)
    ) INTO v_result;

  -- =========================================================================
  -- MODULE ASSIGNMENTS
  -- =========================================================================
  WHEN 'module_assignments' THEN
    WITH matched AS (
      SELECT ma.id
      FROM module_assignments ma
      JOIN module_progress mp ON ma.module_progress_id = mp.id
      JOIN client_enrollments ce ON mp.enrollment_id = ce.id
      WHERE (p_user_id IS NULL OR ce.client_user_id = p_user_id)
        AND (p_program_id IS NULL OR ce.program_id = p_program_id)
        AND (p_created_before IS NULL OR ma.created_at < p_created_before)
        AND (p_status IS NULL OR ma.status = p_status)
    )
    SELECT jsonb_build_object(
      'total_count', (SELECT count(*) FROM matched),
      'records', COALESCE((
        SELECT jsonb_agg(row_to_jsonb(r))
        FROM (
          SELECT ma.id, ce.client_user_id AS user_id, ma.status,
                 ma.overall_score, ma.created_at, ma.completed_at,
                 mat.name AS assignment_type_name,
                 pm.title AS module_title
          FROM module_assignments ma
          JOIN matched mt ON ma.id = mt.id
          JOIN module_progress mp ON ma.module_progress_id = mp.id
          JOIN client_enrollments ce ON mp.enrollment_id = ce.id
          LEFT JOIN module_assignment_types mat ON ma.assignment_type_id = mat.id
          LEFT JOIN program_modules pm ON mp.module_id = pm.id
          ORDER BY ma.created_at DESC
          LIMIT p_limit OFFSET p_offset
        ) r
      ), '[]'::jsonb)
    ) INTO v_result;

  -- =========================================================================
  -- MODULE PROGRESS
  -- =========================================================================
  WHEN 'module_progress' THEN
    WITH matched AS (
      SELECT mp.id
      FROM module_progress mp
      JOIN client_enrollments ce ON mp.enrollment_id = ce.id
      WHERE (p_user_id IS NULL OR ce.client_user_id = p_user_id)
        AND (p_program_id IS NULL OR ce.program_id = p_program_id)
        AND (p_created_before IS NULL OR mp.created_at < p_created_before)
        AND (p_status IS NULL OR mp.status::text = p_status)
    )
    SELECT jsonb_build_object(
      'total_count', (SELECT count(*) FROM matched),
      'records', COALESCE((
        SELECT jsonb_agg(row_to_jsonb(r))
        FROM (
          SELECT mp.id, ce.client_user_id AS user_id, mp.status::text AS status,
                 mp.created_at, mp.completed_at,
                 pm.title AS module_title,
                 p.name AS program_name
          FROM module_progress mp
          JOIN matched mt ON mp.id = mt.id
          JOIN client_enrollments ce ON mp.enrollment_id = ce.id
          LEFT JOIN program_modules pm ON mp.module_id = pm.id
          LEFT JOIN programs p ON ce.program_id = p.id
          ORDER BY mp.created_at DESC
          LIMIT p_limit OFFSET p_offset
        ) r
      ), '[]'::jsonb)
    ) INTO v_result;

  ELSE
    RAISE EXCEPTION 'Unknown entity type: %', p_entity_type;
  END CASE;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_data_cleanup_list_records TO authenticated;
