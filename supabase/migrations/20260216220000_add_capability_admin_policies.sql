-- Add admin full-access policies to all tables missing them.
-- Admin must be able to see and do everything.
-- Excludes signup_verification_requests and email_change_requests (service-role-only by design).
-- Uses IF EXISTS checks so the migration succeeds even if some tables don't exist on a given env.

DO $$
DECLARE
  _tables text[] := ARRAY[
    -- Capability assessment tables (9)
    'capability_assessments',
    'capability_domains',
    'capability_domain_questions',
    'capability_snapshots',
    'capability_snapshot_ratings',
    'capability_domain_notes',
    'capability_question_notes',
    'instructor_capability_evaluations',
    'instructor_capability_ratings',
    -- Decision sub-tables (8)
    'decision_comments',
    'decision_cons',
    'decision_goals',
    'decision_journal_entries',
    'decision_options',
    'decision_pros',
    'decision_reflections',
    'decision_values',
    -- Development item link tables (9)
    'development_item_domain_links',
    'development_item_goal_links',
    'development_item_group_links',
    'development_item_links',
    'development_item_milestone_links',
    'development_item_module_links',
    'development_item_question_links',
    'development_item_snapshot_links',
    'development_item_task_links',
    -- User-personal tables (9)
    'ai_preferences',
    'task_comments',
    'task_note_resources',
    'task_notes',
    'user_external_calendars',
    'user_notification_preferences',
    'user_oauth_tokens',
    'wheel_domain_reflections',
    'generated_prompts',
    -- Other tables (2)
    'external_course_skills',
    'plan_credit_rollovers'
  ];
  _t text;
  _policy_name text;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    -- Only create policy if the table exists in this environment
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = _t
    ) THEN
      -- Generate a short policy name from the table name
      _policy_name := replace(
        regexp_replace(_t, '[aeiou]', '', 'g'),  -- remove vowels for brevity
        '_', ''
      ) || '_all_admin';
      -- Truncate to 63 chars (Postgres identifier limit)
      _policy_name := left(_policy_name, 63);

      -- Drop if exists (idempotent)
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _policy_name, _t);

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))',
        _policy_name, _t
      );

      RAISE NOTICE 'Created admin policy % on %', _policy_name, _t;
    ELSE
      RAISE NOTICE 'Skipped % (table does not exist)', _t;
    END IF;
  END LOOP;
END $$;
