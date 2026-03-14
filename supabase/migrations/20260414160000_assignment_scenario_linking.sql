-- Link scenario assignments ↔ module assignments ↔ capability snapshots
-- + Add content_role tagging for personalised module content

-- =============================================================================
-- A. scenario_assignment_id on module_assignments
-- =============================================================================
ALTER TABLE module_assignments
  ADD COLUMN scenario_assignment_id UUID REFERENCES scenario_assignments(id) ON DELETE SET NULL;

CREATE INDEX idx_module_assignments_scenario_assignment_id
  ON module_assignments(scenario_assignment_id) WHERE scenario_assignment_id IS NOT NULL;

-- =============================================================================
-- B. scoring_snapshot_id on scenario_assignments
-- =============================================================================
ALTER TABLE scenario_assignments
  ADD COLUMN scoring_snapshot_id UUID REFERENCES capability_snapshots(id) ON DELETE SET NULL;

CREATE INDEX idx_scenario_assignments_scoring_snapshot_id
  ON scenario_assignments(scoring_snapshot_id) WHERE scoring_snapshot_id IS NOT NULL;

-- =============================================================================
-- C. content_role on personalised content tables
-- =============================================================================
ALTER TABLE module_client_content_attachments
  ADD COLUMN content_role TEXT NOT NULL DEFAULT 'other';

ALTER TABLE module_client_content_resources
  ADD COLUMN content_role TEXT NOT NULL DEFAULT 'other';

-- =============================================================================
-- D. Update admin cleanup RPCs to handle new FKs
-- =============================================================================

-- PREVIEW: Add scenario_assignments to fk_nullify_counts for capability_snapshots
-- and module_assignments to fk_nullify_counts for scenario_assignments
CREATE OR REPLACE FUNCTION admin_data_cleanup_preview(
  p_entity_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_program_id UUID DEFAULT NULL,
  p_created_before TIMESTAMPTZ DEFAULT NULL,
  p_status TEXT DEFAULT NULL
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
      'primary_count', (SELECT count(*) FROM matched),
      'cascade_counts', jsonb_build_object(
        'paragraph_responses', (SELECT count(*) FROM paragraph_responses WHERE assignment_id IN (SELECT id FROM matched)),
        'paragraph_evaluations', (SELECT count(*) FROM paragraph_evaluations WHERE assignment_id IN (SELECT id FROM matched)),
        'paragraph_question_scores', (SELECT count(*) FROM paragraph_question_scores WHERE assignment_id IN (SELECT id FROM matched))
      ),
      'fk_nullify_counts', jsonb_build_object(
        'group_session_activities', (SELECT count(*) FROM group_session_activities WHERE scenario_assignment_id IN (SELECT id FROM matched)),
        'child_assignments', (SELECT count(*) FROM scenario_assignments WHERE parent_assignment_id IN (SELECT id FROM matched)),
        'module_assignments', (SELECT count(*) FROM module_assignments WHERE scenario_assignment_id IN (SELECT id FROM matched))
      ),
      'attachment_file_paths', '[]'::jsonb
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
      'primary_count', (SELECT count(*) FROM matched),
      'cascade_counts', jsonb_build_object(
        'capability_snapshot_ratings', (SELECT count(*) FROM capability_snapshot_ratings WHERE snapshot_id IN (SELECT id FROM matched)),
        'capability_domain_notes', (SELECT count(*) FROM capability_domain_notes WHERE snapshot_id IN (SELECT id FROM matched)),
        'capability_question_notes', (SELECT count(*) FROM capability_question_notes WHERE snapshot_id IN (SELECT id FROM matched)),
        'instructor_capability_evaluations', (SELECT count(*) FROM instructor_capability_evaluations WHERE snapshot_id IN (SELECT id FROM matched)),
        'development_item_snapshot_links', (SELECT count(*) FROM development_item_snapshot_links WHERE snapshot_id IN (SELECT id FROM matched)),
        'development_item_domain_links', (SELECT count(*) FROM development_item_domain_links WHERE snapshot_id IN (SELECT id FROM matched)),
        'development_item_question_links', (SELECT count(*) FROM development_item_question_links WHERE snapshot_id IN (SELECT id FROM matched)),
        'goal_assessment_links', (SELECT count(*) FROM goal_assessment_links WHERE capability_snapshot_id IN (SELECT id FROM matched))
      ),
      'fk_nullify_counts', jsonb_build_object(
        'module_assignments', (SELECT count(*) FROM module_assignments WHERE scoring_snapshot_id IN (SELECT id FROM matched)),
        'group_session_activities', (SELECT count(*) FROM group_session_activities WHERE scoring_snapshot_id IN (SELECT id FROM matched)),
        'scenario_assignments', (SELECT count(*) FROM scenario_assignments WHERE scoring_snapshot_id IN (SELECT id FROM matched))
      ),
      'attachment_file_paths', '[]'::jsonb
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
      'primary_count', (SELECT count(*) FROM matched),
      'cascade_counts', jsonb_build_object(
        'module_assignment_attachments', (SELECT count(*) FROM module_assignment_attachments WHERE assignment_id IN (SELECT id FROM matched))
      ),
      'fk_nullify_counts', '{}'::jsonb,
      'attachment_file_paths', COALESCE(
        (SELECT jsonb_agg(file_path)
         FROM module_assignment_attachments
         WHERE assignment_id IN (SELECT id FROM matched)
           AND file_path IS NOT NULL),
        '[]'::jsonb
      )
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
    ),
    child_assignments AS (
      SELECT ma.id
      FROM module_assignments ma
      WHERE ma.module_progress_id IN (SELECT id FROM matched)
    )
    SELECT jsonb_build_object(
      'primary_count', (SELECT count(*) FROM matched),
      'cascade_counts', jsonb_build_object(
        'module_assignments', (SELECT count(*) FROM child_assignments),
        'module_assignment_attachments', (SELECT count(*) FROM module_assignment_attachments WHERE assignment_id IN (SELECT id FROM child_assignments)),
        'module_reflections', (SELECT count(*) FROM module_reflections WHERE module_progress_id IN (SELECT id FROM matched)),
        'coach_module_feedback', (SELECT count(*) FROM coach_module_feedback WHERE module_progress_id IN (SELECT id FROM matched)),
        'instructor_module_notes', (SELECT count(*) FROM instructor_module_notes WHERE module_progress_id IN (SELECT id FROM matched)),
        'development_item_module_links', (SELECT count(*) FROM development_item_module_links WHERE module_progress_id IN (SELECT id FROM matched))
      ),
      'fk_nullify_counts', '{}'::jsonb,
      'attachment_file_paths', COALESCE(
        (SELECT jsonb_agg(maa.file_path)
         FROM module_assignment_attachments maa
         WHERE maa.assignment_id IN (SELECT id FROM child_assignments)
           AND maa.file_path IS NOT NULL),
        '[]'::jsonb
      )
    ) INTO v_result;

  ELSE
    RAISE EXCEPTION 'Unknown entity type: %', p_entity_type;
  END CASE;

  RETURN v_result;
END;
$$;

-- EXECUTE: Add nullification steps for new FKs
CREATE OR REPLACE FUNCTION admin_data_cleanup_execute(
  p_entity_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_program_id UUID DEFAULT NULL,
  p_created_before TIMESTAMPTZ DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
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
    -- 1. Nullify self-referencing FK (parent_assignment_id)
    UPDATE scenario_assignments
    SET parent_assignment_id = NULL
    WHERE parent_assignment_id IN (
      SELECT sa.id
      FROM scenario_assignments sa
      LEFT JOIN client_enrollments ce ON sa.enrollment_id = ce.id
      WHERE (p_user_id IS NULL OR sa.user_id = p_user_id)
        AND (p_program_id IS NULL OR ce.program_id = p_program_id)
        AND (p_created_before IS NULL OR sa.created_at < p_created_before)
        AND (p_status IS NULL OR sa.status = p_status)
    );

    -- 2. Nullify FK on group_session_activities
    UPDATE group_session_activities
    SET scenario_assignment_id = NULL
    WHERE scenario_assignment_id IN (
      SELECT sa.id
      FROM scenario_assignments sa
      LEFT JOIN client_enrollments ce ON sa.enrollment_id = ce.id
      WHERE (p_user_id IS NULL OR sa.user_id = p_user_id)
        AND (p_program_id IS NULL OR ce.program_id = p_program_id)
        AND (p_created_before IS NULL OR sa.created_at < p_created_before)
        AND (p_status IS NULL OR sa.status = p_status)
    );

    -- 3. Nullify FK on module_assignments.scenario_assignment_id
    UPDATE module_assignments
    SET scenario_assignment_id = NULL
    WHERE scenario_assignment_id IN (
      SELECT sa.id
      FROM scenario_assignments sa
      LEFT JOIN client_enrollments ce ON sa.enrollment_id = ce.id
      WHERE (p_user_id IS NULL OR sa.user_id = p_user_id)
        AND (p_program_id IS NULL OR ce.program_id = p_program_id)
        AND (p_created_before IS NULL OR sa.created_at < p_created_before)
        AND (p_status IS NULL OR sa.status = p_status)
    );

    -- 4. Delete (CASCADE handles paragraph_responses, paragraph_evaluations, paragraph_question_scores)
    WITH deleted AS (
      DELETE FROM scenario_assignments
      WHERE id IN (
        SELECT sa.id
        FROM scenario_assignments sa
        LEFT JOIN client_enrollments ce ON sa.enrollment_id = ce.id
        WHERE (p_user_id IS NULL OR sa.user_id = p_user_id)
          AND (p_program_id IS NULL OR ce.program_id = p_program_id)
          AND (p_created_before IS NULL OR sa.created_at < p_created_before)
          AND (p_status IS NULL OR sa.status = p_status)
      )
      RETURNING id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

  -- =========================================================================
  -- CAPABILITY SNAPSHOTS
  -- =========================================================================
  WHEN 'capability_snapshots' THEN
    -- 1. Nullify FK on module_assignments.scoring_snapshot_id
    UPDATE module_assignments
    SET scoring_snapshot_id = NULL
    WHERE scoring_snapshot_id IN (
      SELECT cs.id
      FROM capability_snapshots cs
      WHERE (p_user_id IS NULL OR cs.user_id = p_user_id)
        AND (p_created_before IS NULL OR cs.created_at < p_created_before)
        AND (p_status IS NULL OR cs.status = p_status)
        AND (p_program_id IS NULL OR cs.enrollment_id IN (
          SELECT id FROM client_enrollments WHERE program_id = p_program_id
        ))
    );

    -- 2. Nullify FK on group_session_activities.scoring_snapshot_id
    UPDATE group_session_activities
    SET scoring_snapshot_id = NULL
    WHERE scoring_snapshot_id IN (
      SELECT cs.id
      FROM capability_snapshots cs
      WHERE (p_user_id IS NULL OR cs.user_id = p_user_id)
        AND (p_created_before IS NULL OR cs.created_at < p_created_before)
        AND (p_status IS NULL OR cs.status = p_status)
        AND (p_program_id IS NULL OR cs.enrollment_id IN (
          SELECT id FROM client_enrollments WHERE program_id = p_program_id
        ))
    );

    -- 3. Nullify FK on scenario_assignments.scoring_snapshot_id
    UPDATE scenario_assignments
    SET scoring_snapshot_id = NULL
    WHERE scoring_snapshot_id IN (
      SELECT cs.id
      FROM capability_snapshots cs
      WHERE (p_user_id IS NULL OR cs.user_id = p_user_id)
        AND (p_created_before IS NULL OR cs.created_at < p_created_before)
        AND (p_status IS NULL OR cs.status = p_status)
        AND (p_program_id IS NULL OR cs.enrollment_id IN (
          SELECT id FROM client_enrollments WHERE program_id = p_program_id
        ))
    );

    -- 4. Explicit DELETE on goal_assessment_links (non-CASCADE FK)
    DELETE FROM goal_assessment_links
    WHERE capability_snapshot_id IN (
      SELECT cs.id
      FROM capability_snapshots cs
      WHERE (p_user_id IS NULL OR cs.user_id = p_user_id)
        AND (p_created_before IS NULL OR cs.created_at < p_created_before)
        AND (p_status IS NULL OR cs.status = p_status)
        AND (p_program_id IS NULL OR cs.enrollment_id IN (
          SELECT id FROM client_enrollments WHERE program_id = p_program_id
        ))
    );

    -- 5. Delete (CASCADE handles ratings, domain_notes, question_notes, instructor_evals, dev_item links)
    WITH deleted AS (
      DELETE FROM capability_snapshots
      WHERE id IN (
        SELECT cs.id
        FROM capability_snapshots cs
        WHERE (p_user_id IS NULL OR cs.user_id = p_user_id)
          AND (p_created_before IS NULL OR cs.created_at < p_created_before)
          AND (p_status IS NULL OR cs.status = p_status)
          AND (p_program_id IS NULL OR cs.enrollment_id IN (
            SELECT id FROM client_enrollments WHERE program_id = p_program_id
          ))
      )
      RETURNING id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

  -- =========================================================================
  -- MODULE ASSIGNMENTS
  -- =========================================================================
  WHEN 'module_assignments' THEN
    -- Delete (CASCADE handles module_assignment_attachments)
    -- Storage file cleanup is handled client-side after this RPC returns
    WITH deleted AS (
      DELETE FROM module_assignments
      WHERE id IN (
        SELECT ma.id
        FROM module_assignments ma
        JOIN module_progress mp ON ma.module_progress_id = mp.id
        JOIN client_enrollments ce ON mp.enrollment_id = ce.id
        WHERE (p_user_id IS NULL OR ce.client_user_id = p_user_id)
          AND (p_program_id IS NULL OR ce.program_id = p_program_id)
          AND (p_created_before IS NULL OR ma.created_at < p_created_before)
          AND (p_status IS NULL OR ma.status = p_status)
      )
      RETURNING id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

  -- =========================================================================
  -- MODULE PROGRESS
  -- =========================================================================
  WHEN 'module_progress' THEN
    -- Delete (CASCADE handles module_assignments → attachments, reflections, notes, feedback, dev_item links)
    -- Storage file cleanup is handled client-side after this RPC returns
    WITH deleted AS (
      DELETE FROM module_progress
      WHERE id IN (
        SELECT mp.id
        FROM module_progress mp
        JOIN client_enrollments ce ON mp.enrollment_id = ce.id
        WHERE (p_user_id IS NULL OR ce.client_user_id = p_user_id)
          AND (p_program_id IS NULL OR ce.program_id = p_program_id)
          AND (p_created_before IS NULL OR mp.created_at < p_created_before)
          AND (p_status IS NULL OR mp.status::text = p_status)
      )
      RETURNING id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

  ELSE
    RAISE EXCEPTION 'Unknown entity type: %', p_entity_type;
  END CASE;

  RETURN jsonb_build_object('deleted', v_deleted_count);
END;
$$;
