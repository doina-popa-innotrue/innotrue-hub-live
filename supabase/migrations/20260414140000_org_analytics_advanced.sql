-- Org Analytics Phase 2: ROI metrics, capability/skills gap analysis, cohort retention
-- New RPC that complements get_org_analytics_summary() with deeper analytics.

CREATE OR REPLACE FUNCTION get_org_analytics_advanced(
  p_org_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_from DATE;
  v_date_to DATE;
  v_member_ids UUID[];
  v_total_members INT;
  v_roi JSONB;
  v_capability_gap JSONB;
  v_cohort_retention JSONB;
BEGIN
  -- Verify caller is org admin/manager
  IF NOT is_org_admin_or_manager(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not an org admin or manager';
  END IF;

  -- Default date range: last 90 days
  v_date_from := COALESCE(p_date_from, CURRENT_DATE - INTERVAL '90 days');
  v_date_to := COALESCE(p_date_to, CURRENT_DATE);

  -- Get all active org member user IDs
  SELECT ARRAY_AGG(user_id), COUNT(*)
  INTO v_member_ids, v_total_members
  FROM organization_members
  WHERE organization_id = p_org_id AND is_active = true;

  -- Handle no members
  IF v_member_ids IS NULL OR array_length(v_member_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'total_members', 0,
      'date_from', v_date_from,
      'date_to', v_date_to,
      'roi_metrics', '{}'::JSONB,
      'capability_gap', '{}'::JSONB,
      'cohort_retention', '{}'::JSONB
    );
  END IF;

  -- =============================================
  -- === ROI METRICS ===
  -- =============================================
  WITH enrollment_costs AS (
    SELECT
      ce.id,
      ce.program_id,
      ce.client_user_id,
      ce.status,
      ce.start_date,
      ce.completed_at,
      COALESCE(ce.final_credit_cost, 0) AS cost
    FROM client_enrollments ce
    WHERE ce.client_user_id = ANY(v_member_ids)
  ),
  roi_totals AS (
    SELECT
      SUM(cost) AS total_investment,
      COUNT(*) AS total_enrollments,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE status != 'cancelled') AS non_cancelled,
      COUNT(DISTINCT client_user_id) FILTER (WHERE status = 'active') AS active_learners,
      ROUND(
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (completed_at - start_date)) / 86400.0
        ) FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL AND start_date IS NOT NULL), 0)::NUMERIC
      , 1) AS avg_completion_days
    FROM enrollment_costs
  ),
  skills_in_period AS (
    SELECT COUNT(*) AS cnt
    FROM user_skills us
    WHERE us.user_id = ANY(v_member_ids)
      AND us.acquired_at::DATE >= v_date_from
      AND us.acquired_at::DATE <= v_date_to
  ),
  credits_consumed_period AS (
    SELECT COALESCE(SUM(quantity), 0) AS consumed
    FROM credit_consumption_log
    WHERE organization_id = p_org_id
      AND consumed_at::DATE >= v_date_from
      AND consumed_at::DATE <= v_date_to
  ),
  program_roi AS (
    SELECT jsonb_agg(prog ORDER BY prog->>'total_investment' DESC) AS arr
    FROM (
      SELECT jsonb_build_object(
        'program_id', p.id,
        'program_name', p.name,
        'total_investment', SUM(ec.cost),
        'completions', COUNT(*) FILTER (WHERE ec.status = 'completed'),
        'total_enrolled', COUNT(*),
        'cost_per_completion', CASE
          WHEN COUNT(*) FILTER (WHERE ec.status = 'completed') > 0
          THEN ROUND(SUM(ec.cost)::NUMERIC / COUNT(*) FILTER (WHERE ec.status = 'completed'), 1)
          ELSE NULL
        END,
        'avg_completion_days', ROUND(
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (ec.completed_at - ec.start_date)) / 86400.0
          ) FILTER (WHERE ec.status = 'completed' AND ec.completed_at IS NOT NULL AND ec.start_date IS NOT NULL), 0)::NUMERIC
        , 1),
        'skills_granted', (
          SELECT COUNT(DISTINCT us.skill_id)
          FROM user_skills us
          JOIN module_skills ms ON us.skill_id = ms.skill_id
          JOIN program_modules pm ON ms.module_id = pm.id
          WHERE pm.program_id = p.id
            AND us.user_id = ANY(v_member_ids)
        )
      ) AS prog
      FROM enrollment_costs ec
      JOIN programs p ON ec.program_id = p.id
      GROUP BY p.id, p.name
    ) sub
  )
  SELECT jsonb_build_object(
    'total_credit_investment', COALESCE(rt.total_investment, 0),
    'cost_per_completion', CASE
      WHEN rt.completed > 0 THEN ROUND(rt.total_investment::NUMERIC / rt.completed, 1)
      ELSE NULL
    END,
    'cost_per_active_learner', CASE
      WHEN rt.active_learners > 0 THEN ROUND(ccp.consumed::NUMERIC / rt.active_learners, 1)
      ELSE NULL
    END,
    'avg_enrollment_completion_days', rt.avg_completion_days,
    'skills_acquired_in_period', sip.cnt,
    'credits_per_skill', CASE
      WHEN sip.cnt > 0 THEN ROUND(ccp.consumed::NUMERIC / sip.cnt, 1)
      ELSE NULL
    END,
    'completion_efficiency', CASE
      WHEN rt.non_cancelled > 0 THEN ROUND(rt.completed::NUMERIC / rt.non_cancelled * 100, 1)
      ELSE 0
    END,
    'total_completions', rt.completed,
    'total_enrollments', rt.total_enrollments,
    'active_learners', rt.active_learners,
    'credits_consumed_in_period', ccp.consumed,
    'program_roi', COALESCE(pr.arr, '[]'::JSONB)
  )
  INTO v_roi
  FROM roi_totals rt
  CROSS JOIN skills_in_period sip
  CROSS JOIN credits_consumed_period ccp
  CROSS JOIN program_roi pr;

  IF v_roi IS NULL THEN
    v_roi := '{}'::JSONB;
  END IF;

  -- =============================================
  -- === CAPABILITY / SKILLS GAP ANALYSIS ===
  -- =============================================
  WITH domain_scores AS (
    SELECT
      ca.id AS assessment_id,
      ca.name AS assessment_name,
      ca.rating_scale,
      cd.id AS domain_id,
      cd.name AS domain_name,
      cd.order_index,
      COUNT(DISTINCT cs.user_id) AS members_assessed,
      ROUND(AVG(csr.rating)::NUMERIC, 2) AS org_avg,
      MIN(csr.rating) AS min_score,
      MAX(csr.rating) AS max_score,
      ROUND(AVG(csr.rating) FILTER (WHERE cs.is_self_assessment = true)::NUMERIC, 2) AS self_avg,
      ROUND(AVG(csr.rating) FILTER (WHERE cs.is_self_assessment = false)::NUMERIC, 2) AS evaluator_avg
    FROM capability_snapshots cs
    JOIN capability_snapshot_ratings csr ON csr.snapshot_id = cs.id
    JOIN capability_domain_questions cdq ON csr.question_id = cdq.id
    JOIN capability_domains cd ON cdq.domain_id = cd.id
    JOIN capability_assessments ca ON cs.assessment_id = ca.id
    WHERE cs.user_id = ANY(v_member_ids)
      AND cs.status = 'completed'
    GROUP BY ca.id, ca.name, ca.rating_scale, cd.id, cd.name, cd.order_index
  ),
  assessment_agg AS (
    SELECT
      ds.assessment_id,
      ds.assessment_name,
      ds.rating_scale,
      MAX(ds.members_assessed) AS members_assessed,
      ROUND(AVG(ds.org_avg)::NUMERIC, 2) AS org_avg_score,
      jsonb_agg(jsonb_build_object(
        'domain_id', ds.domain_id,
        'domain_name', ds.domain_name,
        'org_avg_score', ds.org_avg,
        'min_score', ds.min_score,
        'max_score', ds.max_score,
        'self_avg', ds.self_avg,
        'evaluator_avg', ds.evaluator_avg,
        'self_evaluator_gap', CASE
          WHEN ds.self_avg IS NOT NULL AND ds.evaluator_avg IS NOT NULL
          THEN ROUND((ds.self_avg - ds.evaluator_avg)::NUMERIC, 2)
          ELSE NULL
        END
      ) ORDER BY ds.order_index) AS domains
    FROM domain_scores ds
    GROUP BY ds.assessment_id, ds.assessment_name, ds.rating_scale
  ),
  assessments_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'assessment_id', aa.assessment_id,
      'assessment_name', aa.assessment_name,
      'rating_scale', aa.rating_scale,
      'members_assessed', aa.members_assessed,
      'members_total', v_total_members,
      'coverage_pct', ROUND(aa.members_assessed::NUMERIC / GREATEST(v_total_members, 1) * 100, 1),
      'org_avg_score', aa.org_avg_score,
      'domains', aa.domains
    ) ORDER BY aa.assessment_name), '[]'::JSONB) AS arr
    FROM assessment_agg aa
  ),
  -- Skills coverage analysis
  enrolled_programs AS (
    SELECT DISTINCT ce.program_id
    FROM client_enrollments ce
    WHERE ce.client_user_id = ANY(v_member_ids) AND ce.status != 'cancelled'
  ),
  required_skills AS (
    SELECT DISTINCT ps.skill_id, s.name AS skill_name
    FROM program_skills ps
    JOIN enrolled_programs ep ON ps.program_id = ep.program_id
    JOIN skills s ON ps.skill_id = s.id
  ),
  skill_acquisition AS (
    SELECT
      rs.skill_id,
      rs.skill_name,
      (SELECT COUNT(DISTINCT ep2.program_id)
       FROM program_skills ps2
       JOIN enrolled_programs ep2 ON ps2.program_id = ep2.program_id
       WHERE ps2.skill_id = rs.skill_id
      ) AS required_by_programs,
      COUNT(DISTINCT us.user_id) AS members_acquired,
      (SELECT COUNT(DISTINCT ce2.client_user_id)
       FROM client_enrollments ce2
       JOIN program_skills ps3 ON ce2.program_id = ps3.program_id
       WHERE ce2.client_user_id = ANY(v_member_ids)
         AND ce2.status != 'cancelled'
         AND ps3.skill_id = rs.skill_id
      ) AS members_enrolled
    FROM required_skills rs
    LEFT JOIN user_skills us ON us.skill_id = rs.skill_id AND us.user_id = ANY(v_member_ids)
    GROUP BY rs.skill_id, rs.skill_name
  ),
  skills_json AS (
    SELECT jsonb_build_object(
      'total_program_skills', (SELECT COUNT(*) FROM required_skills),
      'total_acquired', (
        SELECT COUNT(DISTINCT us.skill_id)
        FROM user_skills us
        JOIN required_skills rs ON us.skill_id = rs.skill_id
        WHERE us.user_id = ANY(v_member_ids)
      ),
      'coverage_pct', CASE
        WHEN (SELECT COUNT(*) FROM required_skills) > 0
        THEN ROUND(
          (SELECT COUNT(DISTINCT us.skill_id)
           FROM user_skills us
           JOIN required_skills rs ON us.skill_id = rs.skill_id
           WHERE us.user_id = ANY(v_member_ids)
          )::NUMERIC / (SELECT COUNT(*) FROM required_skills) * 100, 1)
        ELSE 0
      END,
      'top_gaps', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'skill_id', sa.skill_id,
          'skill_name', sa.skill_name,
          'required_by_programs', sa.required_by_programs,
          'members_acquired', sa.members_acquired,
          'members_enrolled', sa.members_enrolled,
          'acquisition_pct', CASE
            WHEN sa.members_enrolled > 0
            THEN ROUND(sa.members_acquired::NUMERIC / sa.members_enrolled * 100, 1)
            ELSE 0
          END
        ) ORDER BY
          CASE WHEN sa.members_enrolled > 0
            THEN sa.members_acquired::NUMERIC / sa.members_enrolled
            ELSE 0
          END ASC
        ), '[]'::JSONB)
        FROM (
          SELECT * FROM skill_acquisition
          ORDER BY
            CASE WHEN members_enrolled > 0
              THEN members_acquired::NUMERIC / members_enrolled
              ELSE 0
            END ASC
          LIMIT 10
        ) sa
      )
    ) AS obj
  )
  SELECT jsonb_build_object(
    'assessments', aj.arr,
    'skills_coverage', sj.obj
  )
  INTO v_capability_gap
  FROM assessments_json aj
  CROSS JOIN skills_json sj;

  IF v_capability_gap IS NULL THEN
    v_capability_gap := jsonb_build_object(
      'assessments', '[]'::JSONB,
      'skills_coverage', jsonb_build_object(
        'total_program_skills', 0,
        'total_acquired', 0,
        'coverage_pct', 0,
        'top_gaps', '[]'::JSONB
      )
    );
  END IF;

  -- =============================================
  -- === COHORT RETENTION ===
  -- =============================================
  WITH cohort_data AS (
    SELECT
      pc.id AS cohort_id,
      pc.name AS cohort_name,
      p.name AS program_name,
      pc.start_date,
      pc.end_date,
      pc.capacity,
      pc.status AS cohort_status,
      COUNT(DISTINCT ce.id) AS total_enrolled,
      COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'active') AS active,
      COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'completed') AS completed,
      COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'paused') AS paused,
      COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'cancelled') AS cancelled
    FROM program_cohorts pc
    JOIN programs p ON pc.program_id = p.id
    JOIN client_enrollments ce ON ce.cohort_id = pc.id
      AND ce.client_user_id = ANY(v_member_ids)
    GROUP BY pc.id, pc.name, p.name, pc.start_date, pc.end_date, pc.capacity, pc.status
  ),
  cohort_attendance AS (
    SELECT
      pc.id AS cohort_id,
      COUNT(DISTINCT csess.id) AS total_sessions,
      COUNT(csa.id) FILTER (WHERE csa.status = 'present') AS present_count,
      COUNT(csa.id) AS total_attendance_records
    FROM program_cohorts pc
    JOIN cohort_sessions csess ON csess.cohort_id = pc.id
    JOIN client_enrollments ce ON ce.cohort_id = pc.id
      AND ce.client_user_id = ANY(v_member_ids)
    LEFT JOIN cohort_session_attendance csa ON csa.session_id = csess.id
      AND csa.enrollment_id = ce.id
    GROUP BY pc.id
  ),
  cohort_modules AS (
    SELECT
      ce.cohort_id,
      COUNT(mp.id) AS total_module_records,
      COUNT(mp.id) FILTER (WHERE mp.status = 'completed') AS modules_completed
    FROM client_enrollments ce
    JOIN module_progress mp ON mp.enrollment_id = ce.id
    WHERE ce.client_user_id = ANY(v_member_ids)
      AND ce.cohort_id IS NOT NULL
    GROUP BY ce.cohort_id
  ),
  cohort_combined AS (
    SELECT
      cd.*,
      COALESCE(ca.total_sessions, 0) AS total_sessions,
      ROUND(
        CASE WHEN COALESCE(ca.total_attendance_records, 0) > 0
          THEN ca.present_count::NUMERIC / ca.total_attendance_records * 100
          ELSE 0
        END, 1
      ) AS attendance_rate,
      ROUND(
        CASE WHEN cd.total_enrolled > 0
          THEN cd.completed::NUMERIC / cd.total_enrolled * 100
          ELSE 0
        END, 1
      ) AS completion_rate,
      ROUND(
        CASE WHEN cd.total_enrolled > 0
          THEN (cd.cancelled + cd.paused)::NUMERIC / cd.total_enrolled * 100
          ELSE 0
        END, 1
      ) AS dropout_rate,
      ROUND(
        CASE WHEN COALESCE(cm.total_module_records, 0) > 0
          THEN cm.modules_completed::NUMERIC / cm.total_module_records * 100
          ELSE 0
        END, 1
      ) AS module_completion_rate
    FROM cohort_data cd
    LEFT JOIN cohort_attendance ca ON ca.cohort_id = cd.cohort_id
    LEFT JOIN cohort_modules cm ON cm.cohort_id = cd.cohort_id
  )
  SELECT jsonb_build_object(
    'cohorts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'cohort_id', cc.cohort_id,
        'cohort_name', cc.cohort_name,
        'program_name', cc.program_name,
        'start_date', cc.start_date,
        'end_date', cc.end_date,
        'capacity', cc.capacity,
        'cohort_status', cc.cohort_status,
        'total_enrolled', cc.total_enrolled,
        'active', cc.active,
        'completed', cc.completed,
        'paused', cc.paused,
        'cancelled', cc.cancelled,
        'completion_rate', cc.completion_rate,
        'dropout_rate', cc.dropout_rate,
        'attendance_rate', cc.attendance_rate,
        'total_sessions', cc.total_sessions,
        'module_completion_rate', cc.module_completion_rate
      ) ORDER BY cc.start_date DESC)
      FROM cohort_combined cc
    ), '[]'::JSONB),
    'overall', jsonb_build_object(
      'avg_completion_rate', COALESCE((
        SELECT ROUND(AVG(cc.completion_rate)::NUMERIC, 1) FROM cohort_combined cc
      ), 0),
      'avg_dropout_rate', COALESCE((
        SELECT ROUND(AVG(cc.dropout_rate)::NUMERIC, 1) FROM cohort_combined cc
      ), 0),
      'avg_attendance_rate', COALESCE((
        SELECT ROUND(AVG(cc.attendance_rate)::NUMERIC, 1) FROM cohort_combined cc
      ), 0),
      'avg_module_completion_rate', COALESCE((
        SELECT ROUND(AVG(cc.module_completion_rate)::NUMERIC, 1) FROM cohort_combined cc
      ), 0),
      'total_cohorts', COALESCE((
        SELECT COUNT(*) FROM cohort_combined
      ), 0)
    )
  )
  INTO v_cohort_retention;

  IF v_cohort_retention IS NULL THEN
    v_cohort_retention := jsonb_build_object(
      'cohorts', '[]'::JSONB,
      'overall', jsonb_build_object(
        'avg_completion_rate', 0,
        'avg_dropout_rate', 0,
        'avg_attendance_rate', 0,
        'avg_module_completion_rate', 0,
        'total_cohorts', 0
      )
    );
  END IF;

  -- === BUILD FINAL RESULT ===
  RETURN jsonb_build_object(
    'total_members', v_total_members,
    'date_from', v_date_from,
    'date_to', v_date_to,
    'roi_metrics', v_roi,
    'capability_gap', v_capability_gap,
    'cohort_retention', v_cohort_retention
  );
END;
$$;

-- Grant execute to authenticated users (RPC enforces org role check internally)
GRANT EXECUTE ON FUNCTION get_org_analytics_advanced(UUID, DATE, DATE) TO authenticated;
