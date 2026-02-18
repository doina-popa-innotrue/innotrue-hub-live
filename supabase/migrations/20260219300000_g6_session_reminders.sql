-- G6: Session Reminders — log table, SQL function, pg_cron job

-- 1. Reminder log to prevent duplicate sends
CREATE TABLE public.cohort_session_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.cohort_sessions(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '1h')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  recipients_count INTEGER DEFAULT 0,
  UNIQUE(session_id, reminder_type)
);

CREATE INDEX idx_reminder_log_session ON public.cohort_session_reminder_log(session_id);

-- RLS — admin only (internal table)
ALTER TABLE public.cohort_session_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reminder logs"
  ON public.cohort_session_reminder_log
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Function that finds upcoming sessions and sends reminders
CREATE OR REPLACE FUNCTION public.send_cohort_session_reminders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_enrollment RECORD;
  v_cohort RECORD;
  v_count_24h INTEGER := 0;
  v_count_1h INTEGER := 0;
  v_recipients INTEGER;
  v_session_start TIMESTAMPTZ;
  v_link TEXT;
  v_meeting_link TEXT;
BEGIN
  -- ======== 24-hour reminders ========
  FOR v_session IN
    SELECT cs.id, cs.title, cs.session_date, cs.start_time, cs.end_time,
           cs.cohort_id, cs.meeting_link, cs.timezone
    FROM public.cohort_sessions cs
    WHERE cs.session_date >= CURRENT_DATE
      AND cs.session_date <= CURRENT_DATE + interval '2 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.cohort_session_reminder_log rl
        WHERE rl.session_id = cs.id AND rl.reminder_type = '24h'
      )
  LOOP
    -- Calculate actual session start in UTC
    v_session_start := (v_session.session_date || ' ' || COALESCE(v_session.start_time::text, '09:00:00'))::timestamp
                       AT TIME ZONE COALESCE(v_session.timezone, 'UTC');

    -- Check if within 23h-25h window from now
    IF v_session_start BETWEEN (now() + interval '23 hours') AND (now() + interval '25 hours') THEN
      -- Get cohort info
      SELECT pc.name, pc.program_id INTO v_cohort
      FROM public.program_cohorts pc WHERE pc.id = v_session.cohort_id;

      v_link := '/programs/' || v_cohort.program_id || '/cohort';
      v_meeting_link := v_session.meeting_link;
      v_recipients := 0;

      -- Send to each enrolled user
      FOR v_enrollment IN
        SELECT ce.client_user_id
        FROM public.client_enrollments ce
        WHERE ce.cohort_id = v_session.cohort_id
          AND ce.status = 'active'
      LOOP
        PERFORM public.create_notification(
          v_enrollment.client_user_id,
          'session_reminder',
          'Session Tomorrow: ' || v_session.title,
          'Your session "' || v_session.title || '" in ' || v_cohort.name || ' is tomorrow'
            || CASE WHEN v_session.start_time IS NOT NULL
                    THEN ' at ' || to_char(v_session.start_time, 'HH24:MI')
                    ELSE '' END
            || '.',
          v_link,
          jsonb_build_object(
            'session_id', v_session.id,
            'session_title', v_session.title,
            'cohort_name', v_cohort.name,
            'session_date', v_session.session_date,
            'start_time', v_session.start_time,
            'meeting_link', v_meeting_link
          )
        );
        v_recipients := v_recipients + 1;
      END LOOP;

      -- Log this reminder
      INSERT INTO public.cohort_session_reminder_log (session_id, reminder_type, recipients_count)
      VALUES (v_session.id, '24h', v_recipients);

      v_count_24h := v_count_24h + 1;
    END IF;
  END LOOP;

  -- ======== 1-hour reminders ========
  FOR v_session IN
    SELECT cs.id, cs.title, cs.session_date, cs.start_time, cs.end_time,
           cs.cohort_id, cs.meeting_link, cs.timezone
    FROM public.cohort_sessions cs
    WHERE cs.session_date = CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM public.cohort_session_reminder_log rl
        WHERE rl.session_id = cs.id AND rl.reminder_type = '1h'
      )
  LOOP
    v_session_start := (v_session.session_date || ' ' || COALESCE(v_session.start_time::text, '09:00:00'))::timestamp
                       AT TIME ZONE COALESCE(v_session.timezone, 'UTC');

    -- Check if within 45m-75m window from now
    IF v_session_start BETWEEN (now() + interval '45 minutes') AND (now() + interval '75 minutes') THEN
      SELECT pc.name, pc.program_id INTO v_cohort
      FROM public.program_cohorts pc WHERE pc.id = v_session.cohort_id;

      v_link := '/programs/' || v_cohort.program_id || '/cohort';
      v_meeting_link := v_session.meeting_link;
      v_recipients := 0;

      FOR v_enrollment IN
        SELECT ce.client_user_id
        FROM public.client_enrollments ce
        WHERE ce.cohort_id = v_session.cohort_id
          AND ce.status = 'active'
      LOOP
        PERFORM public.create_notification(
          v_enrollment.client_user_id,
          'session_reminder',
          'Starting Soon: ' || v_session.title,
          'Your session "' || v_session.title || '" starts in about 1 hour.'
            || CASE WHEN v_meeting_link IS NOT NULL
                    THEN ' Join link: ' || v_meeting_link
                    ELSE '' END,
          v_link,
          jsonb_build_object(
            'session_id', v_session.id,
            'session_title', v_session.title,
            'cohort_name', v_cohort.name,
            'session_date', v_session.session_date,
            'start_time', v_session.start_time,
            'meeting_link', v_meeting_link
          )
        );
        v_recipients := v_recipients + 1;
      END LOOP;

      INSERT INTO public.cohort_session_reminder_log (session_id, reminder_type, recipients_count)
      VALUES (v_session.id, '1h', v_recipients);

      v_count_1h := v_count_1h + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'sessions_24h', v_count_24h,
    'sessions_1h', v_count_1h
  );
END;
$$;

-- 3. Cron job: every 15 minutes
SELECT cron.schedule(
  'cohort-session-reminders',
  '*/15 * * * *',
  $$SELECT public.send_cohort_session_reminders()$$
);
