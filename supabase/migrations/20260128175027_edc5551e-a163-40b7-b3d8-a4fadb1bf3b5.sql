-- Fix SQL operator precedence bug in get_aggregated_analytics function
-- Line 52 was missing parentheses around the OR clause

CREATE OR REPLACE FUNCTION public.get_aggregated_analytics(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Only allow admins
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'total_events', (
      SELECT COUNT(*) FROM analytics_events ae
      WHERE ae.created_at BETWEEN start_date AND end_date
      AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT user_id FROM analytics_excluded_users))
    ),
    'unique_sessions', (
      SELECT COUNT(DISTINCT session_id) FROM analytics_events ae
      WHERE ae.created_at BETWEEN start_date AND end_date
      AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT user_id FROM analytics_excluded_users))
    ),
    'unique_users', (
      SELECT COUNT(DISTINCT user_id) FROM analytics_events ae
      WHERE ae.created_at BETWEEN start_date AND end_date
      AND ae.user_id IS NOT NULL
      AND ae.user_id NOT IN (SELECT user_id FROM analytics_excluded_users)
    ),
    'events_by_category', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT event_category, COUNT(*) as count
        FROM analytics_events ae
        WHERE ae.created_at BETWEEN start_date AND end_date
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT user_id FROM analytics_excluded_users))
        GROUP BY event_category
        ORDER BY count DESC
      ) t
    ),
    'top_pages', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          REGEXP_REPLACE(page_url, 'https?://[^/]+', '') as page_path,
          COUNT(*) as views,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM analytics_events ae
        WHERE ae.created_at BETWEEN start_date AND end_date
        AND ae.event_name = 'page_view'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT user_id FROM analytics_excluded_users))
        GROUP BY page_path
        ORDER BY views DESC
        LIMIT 20
      ) t
    ),
    'feature_usage', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          event_properties->>'feature' as feature,
          COUNT(*) as usage_count,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM analytics_events ae
        WHERE ae.created_at BETWEEN start_date AND end_date
        AND ae.event_name = 'feature_usage'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT user_id FROM analytics_excluded_users))
        GROUP BY feature
        ORDER BY usage_count DESC
        LIMIT 20
      ) t
    ),
    'events_by_day', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          DATE(ae.created_at) as date,
          COUNT(*) as events,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(DISTINCT user_id) as users
        FROM analytics_events ae
        WHERE ae.created_at BETWEEN start_date AND end_date
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT user_id FROM analytics_excluded_users))
        GROUP BY DATE(ae.created_at)
        ORDER BY date
      ) t
    ),
    'drop_off_analysis', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          event_properties->>'path' as page,
          COUNT(*) as exit_count
        FROM analytics_events ae
        WHERE ae.created_at BETWEEN start_date AND end_date
        AND ae.event_name = 'page_view'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT user_id FROM analytics_excluded_users))
        AND ae.session_id IN (
          SELECT session_id FROM (
            SELECT session_id, MAX(created_at) as last_event
            FROM analytics_events
            WHERE created_at BETWEEN start_date AND end_date
            GROUP BY session_id
          ) last_events
          WHERE last_event < end_date - INTERVAL '30 minutes'
        )
        GROUP BY page
        ORDER BY exit_count DESC
        LIMIT 10
      ) t
    ),
    'error_summary', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          event_properties->>'message' as error_message,
          COUNT(*) as occurrences
        FROM analytics_events ae
        WHERE ae.created_at BETWEEN start_date AND end_date
        AND ae.event_name = 'error'
        AND (ae.user_id IS NULL OR ae.user_id NOT IN (SELECT user_id FROM analytics_excluded_users))
        GROUP BY error_message
        ORDER BY occurrences DESC
        LIMIT 10
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;