-- =============================================================================
-- SC-3: Server-Side Aggregation RPCs
-- =============================================================================
-- Replace client-side aggregation with server-side RPCs for:
-- 1. ConsumptionAnalytics features tab
-- 2. ConsumptionAnalytics credit summary stats
-- 3. DataCleanupManager preview
-- =============================================================================

-- ── 1. Feature usage summary (ConsumptionAnalytics features tab) ────────────
-- Replaces: loading ALL usage_tracking records → client-side Map aggregation

CREATE OR REPLACE FUNCTION public.get_feature_usage_summary(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_feature_key text DEFAULT NULL
)
RETURNS TABLE (
  feature_key text,
  total_usage bigint,
  unique_users bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ut.feature_key,
    SUM(ut.used_count)::bigint AS total_usage,
    COUNT(DISTINCT ut.user_id)::bigint AS unique_users
  FROM usage_tracking ut
  WHERE ut.period_start >= p_start_date
    AND ut.period_start <= p_end_date
    AND (p_feature_key IS NULL OR ut.feature_key = p_feature_key)
  GROUP BY ut.feature_key;
$$;

GRANT EXECUTE ON FUNCTION public.get_feature_usage_summary(timestamptz, timestamptz, text) TO authenticated;

-- ── 2. Credit transaction summary (ConsumptionAnalytics summary cards) ──────
-- Replaces: loading ALL user_credit_transactions → client-side filter + reduce

CREATE OR REPLACE FUNCTION public.get_credit_transaction_summary()
RETURNS TABLE (
  total_consumed bigint,
  total_granted bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN transaction_type = 'consumption' THEN ABS(amount) ELSE 0 END), 0)::bigint AS total_consumed,
    COALESCE(SUM(CASE WHEN transaction_type != 'consumption' AND amount > 0 THEN amount ELSE 0 END), 0)::bigint AS total_granted
  FROM user_credit_transactions;
$$;

GRANT EXECUTE ON FUNCTION public.get_credit_transaction_summary() TO authenticated;

-- ── 3. Analytics cleanup preview (DataCleanupManager) ───────────────────────
-- Replaces: 4 separate queries (count, session_ids, categories, oldest/newest)
-- that load ALL rows to aggregate client-side

CREATE OR REPLACE FUNCTION public.get_analytics_cleanup_preview(
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totalEvents', (
      SELECT COUNT(*) FROM analytics_events
      WHERE created_at >= p_start_date AND created_at <= p_end_date
    ),
    'uniqueSessions', (
      SELECT COUNT(DISTINCT session_id) FROM analytics_events
      WHERE created_at >= p_start_date AND created_at <= p_end_date
    ),
    'eventCategories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('category', cat, 'count', cnt) ORDER BY cnt DESC)
      FROM (
        SELECT COALESCE(event_category, 'uncategorized') AS cat, COUNT(*) AS cnt
        FROM analytics_events
        WHERE created_at >= p_start_date AND created_at <= p_end_date
        GROUP BY COALESCE(event_category, 'uncategorized')
        ORDER BY cnt DESC
        LIMIT 20
      ) sub
    ), '[]'::jsonb),
    'oldestEvent', (
      SELECT created_at FROM analytics_events
      WHERE created_at >= p_start_date AND created_at <= p_end_date
      ORDER BY created_at ASC LIMIT 1
    ),
    'newestEvent', (
      SELECT created_at FROM analytics_events
      WHERE created_at >= p_start_date AND created_at <= p_end_date
      ORDER BY created_at DESC LIMIT 1
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_cleanup_preview(timestamptz, timestamptz) TO authenticated;
