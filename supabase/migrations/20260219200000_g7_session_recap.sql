-- G7: Session Recap — adds recap + recording_url to cohort_sessions,
-- plus a notification function to alert enrolled clients when a recap is published.

-- 1. Add recap and recording_url columns
ALTER TABLE public.cohort_sessions
  ADD COLUMN recap TEXT,
  ADD COLUMN recording_url TEXT;

-- 2. Seed session_recap_available notification type
INSERT INTO notification_types (
  key,
  category_id,
  name,
  description,
  icon,
  is_active,
  email_template_key,
  order_index
)
SELECT
  'session_recap_available',
  (SELECT id FROM notification_categories WHERE key = 'sessions' LIMIT 1),
  'Session Recap Available',
  'When an instructor publishes a recap for a session you attended',
  'file-text',
  true,
  'session_recap_available',
  5
WHERE NOT EXISTS (
  SELECT 1 FROM notification_types WHERE key = 'session_recap_available'
);

-- 3. Function to notify enrolled users about a new session recap
CREATE OR REPLACE FUNCTION public.notify_cohort_session_recap(p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_cohort RECORD;
  v_enrollment RECORD;
  v_count INTEGER := 0;
  v_link TEXT;
BEGIN
  -- Get session details
  SELECT cs.id, cs.title, cs.cohort_id, cs.session_date, cs.recap
  INTO v_session
  FROM public.cohort_sessions cs
  WHERE cs.id = p_session_id;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  -- Get cohort + program for link building
  SELECT pc.id, pc.name, pc.program_id
  INTO v_cohort
  FROM public.program_cohorts pc
  WHERE pc.id = v_session.cohort_id;

  v_link := '/programs/' || v_cohort.program_id || '/cohort';

  -- Loop through enrolled users in this cohort
  FOR v_enrollment IN
    SELECT ce.client_user_id
    FROM public.client_enrollments ce
    WHERE ce.cohort_id = v_session.cohort_id
      AND ce.status = 'active'
  LOOP
    PERFORM public.create_notification(
      v_enrollment.client_user_id,
      'session_recap_available',
      'Session Recap: ' || v_session.title,
      'A recap has been posted for "' || v_session.title || '" in ' || v_cohort.name || '.',
      v_link,
      jsonb_build_object(
        'session_id', v_session.id,
        'session_title', v_session.title,
        'cohort_name', v_cohort.name,
        'session_date', v_session.session_date
      )
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_cohort_session_recap(UUID) TO authenticated;
