-- Org Analytics Foundation: RLS for credit_consumption_log, index, and
-- get_org_analytics_summary() aggregation RPC for the org admin dashboard.

-- 1. Add index on credit_consumption_log.organization_id for org-level queries
CREATE INDEX IF NOT EXISTS idx_credit_consumption_log_org_id
  ON public.credit_consumption_log (organization_id)
  WHERE organization_id IS NOT NULL;

-- 2. RLS policy: org admins can view credit consumption for their org members
CREATE POLICY "Org admins can view org credit consumption logs"
  ON public.credit_consumption_log FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND is_org_admin_or_manager(auth.uid(), organization_id)
  );

-- 3. Aggregation RPC for org analytics dashboard
--    Returns a JSONB summary with enrollment stats, module progress,
--    scenario stats, capability assessment stats, credit usage, and
--    member engagement data — all scoped to org members.
CREATE OR REPLACE FUNCTION get_org_analytics_summary(
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
  v_result JSONB;
  v_enrollment_stats JSONB;
  v_module_stats JSONB;
  v_scenario_stats JSONB;
  v_capability_stats JSONB;
  v_credit_stats JSONB;
  v_program_breakdown JSONB;
  v_member_engagement JSONB;
  v_enrollment_trends JSONB;
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
      'enrollment_stats', '{}'::JSONB,
      'module_stats', '{}'::JSONB,
      'scenario_stats', '{}'::JSONB,
      'capability_stats', '{}'::JSONB,
      'credit_stats', '{}'::JSONB,
      'program_breakdown', '[]'::JSONB,
      'member_engagement', '[]'::JSONB,
      'enrollment_trends', '[]'::JSONB
    );
  END IF;

  -- === ENROLLMENT STATS ===
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE ce.status = 'active'),
    'completed', COUNT(*) FILTER (WHERE ce.status = 'completed'),
    'paused', COUNT(*) FILTER (WHERE ce.status = 'paused'),
    'cancelled', COUNT(*) FILTER (WHERE ce.status = 'cancelled'),
    'completion_rate', CASE
      WHEN COUNT(*) > 0 THEN ROUND(
        COUNT(*) FILTER (WHERE ce.status = 'completed')::NUMERIC / COUNT(*)::NUMERIC * 100, 1
      )
      ELSE 0
    END,
    'new_in_period', COUNT(*) FILTER (
      WHERE ce.created_at::DATE >= v_date_from AND ce.created_at::DATE <= v_date_to
    ),
    'completed_in_period', COUNT(*) FILTER (
      WHERE ce.status = 'completed'
      AND ce.updated_at::DATE >= v_date_from AND ce.updated_at::DATE <= v_date_to
    ),
    'unique_learners', COUNT(DISTINCT ce.client_user_id),
    'avg_enrollments_per_member', ROUND(COUNT(*)::NUMERIC / GREATEST(v_total_members, 1), 1)
  )
  INTO v_enrollment_stats
  FROM client_enrollments ce
  WHERE ce.client_user_id = ANY(v_member_ids);

  -- === MODULE PROGRESS STATS ===
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'completed', COUNT(*) FILTER (WHERE mp.status = 'completed'),
    'in_progress', COUNT(*) FILTER (WHERE mp.status = 'in_progress'),
    'not_started', COUNT(*) FILTER (WHERE mp.status = 'not_started'),
    'completion_rate', CASE
      WHEN COUNT(*) > 0 THEN ROUND(
        COUNT(*) FILTER (WHERE mp.status = 'completed')::NUMERIC / COUNT(*)::NUMERIC * 100, 1
      )
      ELSE 0
    END,
    'completed_in_period', COUNT(*) FILTER (
      WHERE mp.status = 'completed'
      AND mp.completed_at::DATE >= v_date_from AND mp.completed_at::DATE <= v_date_to
    ),
    'avg_completion_days', ROUND(
      COALESCE(AVG(
        EXTRACT(EPOCH FROM (mp.completed_at - mp.created_at)) / 86400.0
      ) FILTER (WHERE mp.status = 'completed' AND mp.completed_at IS NOT NULL AND mp.created_at IS NOT NULL), 0)::NUMERIC, 1
    )
  )
  INTO v_module_stats
  FROM module_progress mp
  JOIN client_enrollments ce ON mp.enrollment_id = ce.id
  WHERE ce.client_user_id = ANY(v_member_ids);

  -- === SCENARIO ASSIGNMENT STATS ===
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'draft', COUNT(*) FILTER (WHERE sa.status = 'draft'),
    'submitted', COUNT(*) FILTER (WHERE sa.status = 'submitted'),
    'in_review', COUNT(*) FILTER (WHERE sa.status = 'in_review'),
    'evaluated', COUNT(*) FILTER (WHERE sa.status = 'evaluated'),
    'completion_rate', CASE
      WHEN COUNT(*) > 0 THEN ROUND(
        COUNT(*) FILTER (WHERE sa.status = 'evaluated')::NUMERIC / COUNT(*)::NUMERIC * 100, 1
      )
      ELSE 0
    END,
    'submitted_in_period', COUNT(*) FILTER (
      WHERE sa.submitted_at::DATE >= v_date_from AND sa.submitted_at::DATE <= v_date_to
    ),
    'evaluated_in_period', COUNT(*) FILTER (
      WHERE sa.evaluated_at::DATE >= v_date_from AND sa.evaluated_at::DATE <= v_date_to
    ),
    'unique_participants', COUNT(DISTINCT sa.user_id)
  )
  INTO v_scenario_stats
  FROM scenario_assignments sa
  WHERE sa.user_id = ANY(v_member_ids);

  -- === CAPABILITY ASSESSMENT STATS ===
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'completed', COUNT(*) FILTER (WHERE cs.status = 'completed'),
    'in_progress', COUNT(*) FILTER (WHERE cs.status = 'in_progress'),
    'self_assessments', COUNT(*) FILTER (WHERE cs.is_self_assessment = true),
    'evaluator_assessments', COUNT(*) FILTER (WHERE cs.is_self_assessment = false),
    'completed_in_period', COUNT(*) FILTER (
      WHERE cs.status = 'completed'
      AND cs.completed_at::DATE >= v_date_from AND cs.completed_at::DATE <= v_date_to
    ),
    'unique_assessed', COUNT(DISTINCT cs.user_id)
  )
  INTO v_capability_stats
  FROM capability_snapshots cs
  WHERE cs.user_id = ANY(v_member_ids);

  -- === CREDIT USAGE STATS (org-level) ===
  SELECT jsonb_build_object(
    'total_purchased', COALESCE(ob.total_purchased, 0),
    'total_consumed', COALESCE(ob.total_consumed, 0),
    'available', COALESCE(ob.available_credits, 0),
    'reserved', COALESCE(ob.reserved_credits, 0),
    'consumed_in_period', (
      SELECT COALESCE(SUM(ccl.quantity), 0)
      FROM credit_consumption_log ccl
      WHERE ccl.organization_id = p_org_id
        AND ccl.consumed_at::DATE >= v_date_from
        AND ccl.consumed_at::DATE <= v_date_to
    ),
    'recent_transactions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', oct.transaction_type,
        'amount', oct.amount,
        'description', oct.description,
        'created_at', oct.created_at
      ) ORDER BY oct.created_at DESC), '[]'::JSONB)
      FROM (
        SELECT transaction_type, amount, description, created_at
        FROM org_credit_transactions
        WHERE organization_id = p_org_id
        ORDER BY created_at DESC
        LIMIT 10
      ) oct
    )
  )
  INTO v_credit_stats
  FROM org_credit_balances ob
  WHERE ob.organization_id = p_org_id;

  -- Default if no balance row
  IF v_credit_stats IS NULL THEN
    v_credit_stats := jsonb_build_object(
      'total_purchased', 0, 'total_consumed', 0,
      'available', 0, 'reserved', 0,
      'consumed_in_period', 0, 'recent_transactions', '[]'::JSONB
    );
  END IF;

  -- === PROGRAM BREAKDOWN ===
  SELECT COALESCE(jsonb_agg(prog ORDER BY prog.total_enrolled DESC), '[]'::JSONB)
  INTO v_program_breakdown
  FROM (
    SELECT jsonb_build_object(
      'program_id', p.id,
      'program_name', p.name,
      'total_enrolled', COUNT(*),
      'active', COUNT(*) FILTER (WHERE ce.status = 'active'),
      'completed', COUNT(*) FILTER (WHERE ce.status = 'completed'),
      'completion_rate', CASE
        WHEN COUNT(*) > 0 THEN ROUND(
          COUNT(*) FILTER (WHERE ce.status = 'completed')::NUMERIC / COUNT(*)::NUMERIC * 100, 1
        )
        ELSE 0
      END,
      'module_completion_rate', (
        SELECT CASE
          WHEN COUNT(*) > 0 THEN ROUND(
            COUNT(*) FILTER (WHERE mp2.status = 'completed')::NUMERIC / COUNT(*)::NUMERIC * 100, 1
          )
          ELSE 0
        END
        FROM module_progress mp2
        JOIN client_enrollments ce2 ON mp2.enrollment_id = ce2.id
        WHERE ce2.program_id = p.id AND ce2.client_user_id = ANY(v_member_ids)
      )
    ) AS prog
    FROM client_enrollments ce
    JOIN programs p ON ce.program_id = p.id
    WHERE ce.client_user_id = ANY(v_member_ids)
    GROUP BY p.id, p.name
  ) sub;

  -- === MEMBER ENGAGEMENT (top 20) ===
  SELECT COALESCE(jsonb_agg(mem ORDER BY mem->>'enrollment_count' DESC NULLS LAST), '[]'::JSONB)
  INTO v_member_engagement
  FROM (
    SELECT jsonb_build_object(
      'user_id', om.user_id,
      'enrollment_count', (
        SELECT COUNT(*) FROM client_enrollments ce
        WHERE ce.client_user_id = om.user_id
      ),
      'completed_enrollments', (
        SELECT COUNT(*) FROM client_enrollments ce
        WHERE ce.client_user_id = om.user_id AND ce.status = 'completed'
      ),
      'modules_completed', (
        SELECT COUNT(*) FROM module_progress mp
        JOIN client_enrollments ce ON mp.enrollment_id = ce.id
        WHERE ce.client_user_id = om.user_id AND mp.status = 'completed'
      ),
      'scenarios_evaluated', (
        SELECT COUNT(*) FROM scenario_assignments sa
        WHERE sa.user_id = om.user_id AND sa.status = 'evaluated'
      ),
      'assessments_completed', (
        SELECT COUNT(*) FROM capability_snapshots cs
        WHERE cs.user_id = om.user_id AND cs.status = 'completed'
      ),
      'last_activity', GREATEST(
        (SELECT MAX(ce.updated_at) FROM client_enrollments ce WHERE ce.client_user_id = om.user_id),
        (SELECT MAX(mp.updated_at) FROM module_progress mp JOIN client_enrollments ce ON mp.enrollment_id = ce.id WHERE ce.client_user_id = om.user_id),
        (SELECT MAX(sa.updated_at) FROM scenario_assignments sa WHERE sa.user_id = om.user_id)
      ),
      'joined_at', om.joined_at
    ) AS mem
    FROM organization_members om
    WHERE om.organization_id = p_org_id AND om.is_active = true
    ORDER BY (
      SELECT COUNT(*) FROM client_enrollments ce WHERE ce.client_user_id = om.user_id
    ) DESC
    LIMIT 20
  ) sub;

  -- === ENROLLMENT TRENDS (weekly buckets in date range) ===
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'week_start', w.week_start,
    'new_enrollments', w.new_enrollments,
    'completions', w.completions
  ) ORDER BY w.week_start), '[]'::JSONB)
  INTO v_enrollment_trends
  FROM (
    SELECT
      date_trunc('week', d.d)::DATE AS week_start,
      COUNT(*) FILTER (
        WHERE ce.created_at::DATE >= date_trunc('week', d.d)::DATE
        AND ce.created_at::DATE < (date_trunc('week', d.d) + INTERVAL '7 days')::DATE
        AND ce.id IS NOT NULL
      ) AS new_enrollments,
      COUNT(*) FILTER (
        WHERE ce.status = 'completed'
        AND ce.updated_at::DATE >= date_trunc('week', d.d)::DATE
        AND ce.updated_at::DATE < (date_trunc('week', d.d) + INTERVAL '7 days')::DATE
        AND ce.id IS NOT NULL
      ) AS completions
    FROM generate_series(
      date_trunc('week', v_date_from::TIMESTAMP),
      date_trunc('week', v_date_to::TIMESTAMP),
      '1 week'::INTERVAL
    ) d(d)
    LEFT JOIN client_enrollments ce
      ON ce.client_user_id = ANY(v_member_ids)
      AND (
        (ce.created_at::DATE >= date_trunc('week', d.d)::DATE
         AND ce.created_at::DATE < (date_trunc('week', d.d) + INTERVAL '7 days')::DATE)
        OR
        (ce.status = 'completed'
         AND ce.updated_at::DATE >= date_trunc('week', d.d)::DATE
         AND ce.updated_at::DATE < (date_trunc('week', d.d) + INTERVAL '7 days')::DATE)
      )
    GROUP BY date_trunc('week', d.d)::DATE
  ) w;

  -- === BUILD FINAL RESULT ===
  v_result := jsonb_build_object(
    'total_members', v_total_members,
    'date_from', v_date_from,
    'date_to', v_date_to,
    'enrollment_stats', v_enrollment_stats,
    'module_stats', v_module_stats,
    'scenario_stats', v_scenario_stats,
    'capability_stats', v_capability_stats,
    'credit_stats', v_credit_stats,
    'program_breakdown', v_program_breakdown,
    'member_engagement', v_member_engagement,
    'enrollment_trends', v_enrollment_trends
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (RPC enforces org role check internally)
GRANT EXECUTE ON FUNCTION get_org_analytics_summary(UUID, DATE, DATE) TO authenticated;
