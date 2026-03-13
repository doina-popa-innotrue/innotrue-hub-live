-- Seed demo data for organisation functionality.
-- Uses ON CONFLICT DO NOTHING throughout for idempotency.
-- References existing demo users from seed.sql (admin, clients, coach, instructor).
-- Safely skips if demo users don't exist (e.g. sandbox/Lovable).

DO $$
DECLARE
  -- Existing demo user UUIDs (from seed.sql)
  v_admin_id      UUID := 'a0000000-0000-0000-0000-000000000001'; -- Doina Popa (admin)
  v_client1_id    UUID := 'c0000000-0000-0000-0000-000000000001'; -- Sarah Johnson (client)
  v_client2_id    UUID := 'c0000000-0000-0000-0000-000000000002'; -- Michael Chen (client)
  v_coach_id      UUID := 'd0000000-0000-0000-0000-000000000001'; -- Emily Parker (coach)
  v_instructor_id UUID := 'e0000000-0000-0000-0000-000000000001'; -- InnoHub Instructor

  -- New IDs for org entities
  v_org_id       UUID := 'f0000000-0000-0000-0000-000000000001';
  v_org_terms_id UUID := 'f0000000-0000-0000-0000-000000000010';
  v_tier_id      UUID;
  v_plan_pro_id  UUID;
  v_program_id   UUID;
  v_user_exists  BOOLEAN;
BEGIN
  -- Guard: skip entirely if the admin demo user doesn't exist in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = v_admin_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE NOTICE 'Skipping org demo data — demo users not found in auth.users (expected on sandbox/Lovable)';
    RETURN;
  END IF;

  -- ============================================================
  -- 1. Organisation
  -- ============================================================
  INSERT INTO organizations (id, name, slug, description, industry, size_range, website, is_active, settings)
  VALUES (
    v_org_id,
    'Acme Learning Corp',
    'acme-learning',
    'A demo organisation for showcasing B2B features including member management, credit purchasing, analytics, and programme licensing.',
    'Technology & Software',
    '51-200',
    'https://acme-learning.example.com',
    true,
    jsonb_build_object(
      'branding', jsonb_build_object('primary_color', '#2563EB', 'logo_url', null),
      'notifications', jsonb_build_object('seat_limit_warning_threshold', 80)
    )
  )
  ON CONFLICT (slug) DO NOTHING;

  -- ============================================================
  -- 2. Organisation Members
  -- ============================================================
  -- Insert each member individually, guarded by auth.users existence
  IF EXISTS(SELECT 1 FROM auth.users WHERE id = v_admin_id) THEN
    INSERT INTO organization_members (organization_id, user_id, role, is_active, joined_at, title, department)
    VALUES (v_org_id, v_admin_id, 'org_admin'::org_role, true, NOW() - INTERVAL '90 days', 'Learning Director', 'L&D')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF EXISTS(SELECT 1 FROM auth.users WHERE id = v_client1_id) THEN
    INSERT INTO organization_members (organization_id, user_id, role, is_active, joined_at, title, department)
    VALUES (v_org_id, v_client1_id, 'org_member'::org_role, true, NOW() - INTERVAL '60 days', 'Product Manager', 'Product')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF EXISTS(SELECT 1 FROM auth.users WHERE id = v_client2_id) THEN
    INSERT INTO organization_members (organization_id, user_id, role, is_active, joined_at, title, department)
    VALUES (v_org_id, v_client2_id, 'org_member'::org_role, true, NOW() - INTERVAL '30 days', 'Software Engineer', 'Engineering')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF EXISTS(SELECT 1 FROM auth.users WHERE id = v_coach_id) THEN
    INSERT INTO organization_members (organization_id, user_id, role, is_active, joined_at, title, department)
    VALUES (v_org_id, v_coach_id, 'org_manager'::org_role, true, NOW() - INTERVAL '75 days', 'Head of Coaching', 'L&D')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF EXISTS(SELECT 1 FROM auth.users WHERE id = v_instructor_id) THEN
    INSERT INTO organization_members (organization_id, user_id, role, is_active, joined_at, title, department)
    VALUES (v_org_id, v_instructor_id, 'org_member'::org_role, true, NOW() - INTERVAL '45 days', 'Senior Trainer', 'L&D')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- ============================================================
  -- 3. Organisation Terms
  -- ============================================================
  INSERT INTO organization_terms (id, organization_id, title, content_html, version, is_current, effective_from, created_by, is_blocking_on_first_access, is_blocking_on_update)
  VALUES (
    v_org_terms_id,
    v_org_id,
    'Acme Learning Platform Usage Policy',
    '<h2>Terms of Use</h2>
<p>By accessing the InnoTrue learning platform through Acme Learning Corp, you agree to the following terms:</p>
<ol>
  <li><strong>Acceptable Use:</strong> The platform is provided for professional development purposes. All content and assessments must be completed by the enrolled individual.</li>
  <li><strong>Data Sharing:</strong> Your learning progress, assessment results, and engagement data may be shared with your organisation''s L&amp;D team in aggregated or individual form, subject to your sharing consent preferences.</li>
  <li><strong>Confidentiality:</strong> Course materials, scenarios, and assessment content are proprietary. Do not share, copy, or distribute any content outside the platform.</li>
  <li><strong>Support:</strong> For technical issues, contact your organisation''s L&amp;D coordinator or the platform support team.</li>
</ol>
<p><em>Last updated: March 2026</em></p>',
    1,
    true,
    (NOW() - INTERVAL '90 days')::DATE,
    v_admin_id,
    true,
    false
  )
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 4. Organisation Sharing Consent (per member, guarded)
  -- ============================================================
  IF EXISTS(SELECT 1 FROM organization_members WHERE organization_id = v_org_id AND user_id = v_client1_id) THEN
    INSERT INTO organization_sharing_consent (organization_id, user_id, share_progress, share_assessments, share_assignments, share_goals, share_tasks, share_decisions, share_development_items, consent_given_at)
    VALUES (v_org_id, v_client1_id, true, true, true, true, true, true, true, NOW() - INTERVAL '58 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF EXISTS(SELECT 1 FROM organization_members WHERE organization_id = v_org_id AND user_id = v_client2_id) THEN
    INSERT INTO organization_sharing_consent (organization_id, user_id, share_progress, share_assessments, share_assignments, share_goals, share_tasks, share_decisions, share_development_items, consent_given_at)
    VALUES (v_org_id, v_client2_id, true, true, false, false, false, false, false, NOW() - INTERVAL '28 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF EXISTS(SELECT 1 FROM organization_members WHERE organization_id = v_org_id AND user_id = v_coach_id) THEN
    INSERT INTO organization_sharing_consent (organization_id, user_id, share_progress, share_assessments, share_assignments, share_goals, share_tasks, share_decisions, share_development_items, consent_given_at)
    VALUES (v_org_id, v_coach_id, true, true, true, true, true, true, true, NOW() - INTERVAL '73 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF EXISTS(SELECT 1 FROM organization_members WHERE organization_id = v_org_id AND user_id = v_instructor_id) THEN
    INSERT INTO organization_sharing_consent (organization_id, user_id, share_progress, share_assessments, share_assignments, share_goals, share_tasks, share_decisions, share_development_items, consent_given_at)
    VALUES (v_org_id, v_instructor_id, true, false, true, false, false, false, false, NOW() - INTERVAL '43 days')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ============================================================
  -- 5. Platform Subscription (link org to a tier)
  -- ============================================================
  SELECT id INTO v_tier_id FROM org_platform_tiers WHERE slug = 'professional' LIMIT 1;

  IF v_tier_id IS NOT NULL THEN
    INSERT INTO org_platform_subscriptions (
      organization_id, tier_id, status, billing_period,
      billing_email, starts_at,
      current_period_start, current_period_end
    )
    VALUES (
      v_org_id, v_tier_id, 'active', 'annual',
      'billing@acme-learning.example.com',
      NOW() - INTERVAL '90 days',
      DATE_TRUNC('month', NOW()),
      DATE_TRUNC('month', NOW()) + INTERVAL '1 year'
    )
    ON CONFLICT (organization_id) DO NOTHING;
  END IF;

  -- ============================================================
  -- 6. Credit Balance
  -- ============================================================
  INSERT INTO org_credit_balances (organization_id, total_purchased, total_consumed, available_credits, reserved_credits)
  VALUES (v_org_id, 5000, 1200, 3800, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  -- ============================================================
  -- 7. Credit Transactions (purchase + consumption history)
  -- ============================================================
  INSERT INTO org_credit_transactions (organization_id, transaction_type, amount, balance_after, description, performed_by, created_at)
  VALUES
    (v_org_id, 'purchase',     5000,  5000, 'Annual credit package — Growth Package',         v_admin_id, NOW() - INTERVAL '85 days'),
    (v_org_id, 'consumption',  -500,  4500, 'Enrollment: Sarah Johnson — CTA Immersion',      v_admin_id, NOW() - INTERVAL '55 days'),
    (v_org_id, 'consumption',  -200,  4300, 'Enrollment: Michael Chen — Leadership Elevate',   v_admin_id, NOW() - INTERVAL '25 days'),
    (v_org_id, 'consumption',  -300,  4000, 'AI insights usage — March 2026',                 NULL,       NOW() - INTERVAL '15 days'),
    (v_org_id, 'consumption',  -200,  3800, 'Module content access — various members',        NULL,       NOW() - INTERVAL '5 days')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 8. Organisation Programs (license programs for the org)
  -- ============================================================
  FOR v_program_id IN SELECT id FROM programs WHERE is_active = true LIMIT 5
  LOOP
    INSERT INTO organization_programs (organization_id, program_id, is_active, max_enrollments, licensed_at)
    VALUES (v_org_id, v_program_id, true, 50, NOW() - INTERVAL '85 days')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 9. Sponsored Plan for org members (link to Pro plan)
  -- ============================================================
  SELECT id INTO v_plan_pro_id FROM plans WHERE key = 'pro' LIMIT 1;

  IF v_plan_pro_id IS NOT NULL THEN
    UPDATE organization_members
    SET sponsored_plan_id = v_plan_pro_id
    WHERE organization_id = v_org_id
      AND sponsored_plan_id IS NULL
      AND role IN ('org_member', 'org_manager');
  END IF;

  -- ============================================================
  -- 10. Credit consumption log entries (for analytics)
  -- ============================================================
  -- Only insert for users that were successfully added as members
  IF EXISTS(SELECT 1 FROM organization_members WHERE organization_id = v_org_id AND user_id = v_client1_id) THEN
    INSERT INTO credit_consumption_log (user_id, organization_id, quantity, source_type, feature_key, action_type, description, consumed_at)
    VALUES
      (v_client1_id, v_org_id, 3, 'org', 'ai_insights',    'ai_usage',    'AI reflection prompt',      NOW() - INTERVAL '50 days'),
      (v_client1_id, v_org_id, 1, 'org', 'ai_insights',    'ai_usage',    'AI decision insights',      NOW() - INTERVAL '45 days'),
      (v_client1_id, v_org_id, 2, 'org', 'ai_insights',    'ai_usage',    'AI course recommendations', NOW() - INTERVAL '40 days'),
      (v_client1_id, v_org_id, 1, 'org', 'content_access', 'module_view', 'Module content access',     NOW() - INTERVAL '35 days'),
      (v_client1_id, v_org_id, 1, 'org', 'content_access', 'module_view', 'Module content access',     NOW() - INTERVAL '30 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF EXISTS(SELECT 1 FROM organization_members WHERE organization_id = v_org_id AND user_id = v_client2_id) THEN
    INSERT INTO credit_consumption_log (user_id, organization_id, quantity, source_type, feature_key, action_type, description, consumed_at)
    VALUES
      (v_client2_id, v_org_id, 2, 'org', 'ai_insights',    'ai_usage',    'AI reflection prompt',  NOW() - INTERVAL '25 days'),
      (v_client2_id, v_org_id, 1, 'org', 'content_access', 'module_view', 'Module content access', NOW() - INTERVAL '20 days'),
      (v_client2_id, v_org_id, 1, 'org', 'ai_insights',    'ai_usage',    'AI decision insights',  NOW() - INTERVAL '15 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF EXISTS(SELECT 1 FROM organization_members WHERE organization_id = v_org_id AND user_id = v_coach_id) THEN
    INSERT INTO credit_consumption_log (user_id, organization_id, quantity, source_type, feature_key, action_type, description, consumed_at)
    VALUES
      (v_coach_id, v_org_id, 3, 'org', 'ai_insights', 'ai_usage', 'AI analytics insights',     NOW() - INTERVAL '10 days'),
      (v_coach_id, v_org_id, 2, 'org', 'ai_insights', 'ai_usage', 'AI course recommendations', NOW() - INTERVAL '5 days')
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Organisation demo data seeded successfully for Acme Learning Corp (%)' , v_org_id;
END;
$$;
